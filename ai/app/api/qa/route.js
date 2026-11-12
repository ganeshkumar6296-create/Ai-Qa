// ai/app/api/qa/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// Helper: URL ko absolute banane ke liye
function resolveUrl(baseUrl, relativeUrl) {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return null;
  }
}

// Helper: Link ya Image status check karne ke liye
async function checkResourceStatus(url) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };

  try {
    const res = await axios.head(url, { timeout: 5000, maxRedirects: 5, headers });
    return { url, status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (err) {
    // Kuch servers HEAD block karte hain, isliye GET fallback
    try {
      const getRes = await axios.get(url, { timeout: 5000, maxRedirects: 5, headers });
      return { url, status: getRes.status, ok: getRes.status >= 200 && getRes.status < 400 };
    } catch (getErr) {
      return {
        url,
        status: getErr.response?.status || "NETWORK_ERROR",
        ok: false,
      };
    }
  }
}

export async function POST(req) {
  try {
    const { targetUrl } = await req.json();

    if (!targetUrl || !targetUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "Valid URL dalein (e.g., https://example.com)" },
        { status: 400 }
      );
    }

    // 1. Target Website ka HTML Fetch karein (Browser User-Agent ke saath)
    const pageResponse = await axios.get(targetUrl, {
      timeout: 12000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = pageResponse.data;
    const $ = cheerio.load(html);

    // 2. Basic SEO & Meta Details Extract karein
    const seoData = {
      title: $("title").text().trim() || null,
      metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
      canonical: $('link[rel="canonical"]').attr("href") || null,
      viewport: $('meta[name="viewport"]').attr("content") || null,
      h1Count: $("h1").length,
      h1Texts: $("h1").map((_, el) => $(el).text().trim()).get(),
      langAttr: $("html").attr("lang") || null,
    };

    // 3. Links & Images Extract karein
    const rawLinks = new Set();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (
        href &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:")
      ) {
        const fullUrl = resolveUrl(targetUrl, href);
        if (fullUrl) rawLinks.add(fullUrl);
      }
    });

    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      const alt = $(el).attr("alt");
      images.push({
        src: src ? resolveUrl(targetUrl, src) : null,
        hasAlt: alt !== undefined && alt.trim().length > 0,
        altText: alt || "",
      });
    });

    // Performance ke liye pehle 20 links aur 15 images ka live status check karein
    const linksToCheck = Array.from(rawLinks).slice(0, 20);
    const imagesToCheck = images.filter((img) => img.src).slice(0, 15);

    const [linkResults, imageResults] = await Promise.all([
      Promise.all(linksToCheck.map(checkResourceStatus)),
      Promise.all(imagesToCheck.map((img) => checkResourceStatus(img.src))),
    ]);

    const brokenLinks = linkResults.filter((l) => !l.ok);
    const brokenImages = imageResults.filter((i) => !i.ok);
    const missingAltImages = images.filter((i) => !i.hasAlt);

    // 4. Visible Text Extract karein (Content & UI Issues ke liye)
    $("script, style, noscript").remove();
    const visibleText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);

    // 5. FreeLLMAPI ko Technical Findings + Page Content Bhejein
    const inspectionPayload = {
      url: targetUrl,
      confirmedTechnicalChecks: {
        seoData,
        totalLinksFound: rawLinks.size,
        brokenLinks,
        totalImagesFound: images.length,
        brokenImages,
        missingAltImagesCount: missingAltImages.length,
        missingAltSamples: missingAltImages.slice(0, 5),
      },
      pageTextSample: visibleText,
    };

    const systemPrompt = `You are a Senior Website QA Engineer AI. Analyze the provided website technical scan data and visible page text.
Generate a strict, prioritized QA Report in valid JSON format ONLY (no markdown, no backticks, no extra commentary).

CRITICAL RULE: You MUST distinguish between:
1. "confirmedIssues": Issues 100% verified by HTTP status codes, missing HTML tags, broken links, broken images, or exact text errors found in the payload.
2. "suspectedIssues": Potential UI/UX flaws, content inconsistencies, placeholder text (like Lorem Ipsum), tone mismatches, truncation risks, or SEO improvements inferred from the text/structure that need manual visual verification.

Return exact JSON structure:
{
  "summary": {
    "url": "string",
    "overallScore": number (0-100),
    "verdict": "string"
  },
  "confirmedIssues": [
    {
      "id": "CONF-1",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "category": "Broken Link" | "Missing Image" | "SEO" | "Content" | "UI",
      "title": "string",
      "evidence": "string (exact URL, status code, or missing tag)",
      "fix": "string"
    }
  ],
  "suspectedIssues": [
    {
      "id": "SUSP-1",
      "priority": "High" | "Medium" | "Low",
      "category": "UI/UX" | "Content Consistency" | "SEO" | "Accessibility",
      "title": "string",
      "reasoning": "string (why this looks suspicious)",
      "howToVerify": "string"
    }
  ]
}`;

    const baseUrl = (process.env.FREE_LLM_BASE_URL || "http://127.0.0.1:31415/v1").trim();
    const apiKey = (process.env.FREE_LLM_API_KEY || "").trim();

    if (!apiKey) {
      throw new Error("FREE_LLM_API_KEY missing hai! .env.local save karke 'npm run dev' restart karein.");
    }

    const llmResponse = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: (process.env.FREE_LLM_MODEL || "auto").trim(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(inspectionPayload) },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiContent = llmResponse.data?.choices?.[0]?.message?.content?.trim() || "";

    // Safe JSON Extractor: agar LLM JSON ke aage-peeche extra text bheje toh sirf {...} extract karein
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM ne valid JSON return nahi kiya: " + aiContent.slice(0, 150));
    }

    const qaReport = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      report: qaReport,
      rawStats: {
        linksChecked: linksToCheck.length,
        imagesChecked: imagesToCheck.length,
      },
    });
  } catch (error) {
    console.error("FULL QA AGENT ERROR:", error);
    return NextResponse.json(
      {
        error: "Website inspect karne mein error aaya. URL ya API key check karein.",
        details: error.response?.data?.error?.message || error.message,
      },
      { status: 500 }
    );
  }
}