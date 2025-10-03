import express from "express";
import bodyParser from "body-parser";
import { chromium } from "playwright";

const app = express();
app.use(bodyParser.json());

const keywords = [
  "commercial",
  "commercial clean",
  "commercial janitorial",
  "corporate clean",
  "workplace clean",
  "business clean",
  "property clean",
  "building clean",
];

// Analyze keywords in a webpage
async function analyzeKeywords(url, timeout = 30, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let browser;
    try {
     
       browser = await chromium.launch({
        headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      // Block unnecessary resources (images, fonts, css, media)
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (["image", "stylesheet", "font", "media"].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      page.setDefaultTimeout(timeout * 1000);

      if (attempt > 0) {
        // Exponential backoff
        await new Promise((res) => setTimeout(res, 2 ** attempt * 1000));
      }

      await page.goto(url, { waitUntil: "domcontentloaded" });

      // Extract page text
      const textContent = (
        await page.evaluate(() => document.body.innerText)
      ).toLowerCase();

      await context.close();
      await browser.close();

      // Check keywords
      const results = {};
      for (let k of keywords) {
        results[k] = textContent.includes(k.toLowerCase());
      }

      return results;
    } catch (err) {
      if (browser) await browser.close();
      if (attempt === maxRetries - 1) {
        return {
          error: {
            message: `Failed after ${maxRetries} attempts: ${err.message}`,
            status_code: 500,
          },
        };
      }
    }
  }
}

// API Endpoint
app.post("/analyze", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  console.log("API Call - starting analysis for URL:", url);
  const start = Date.now();

  const results = await analyzeKeywords(url);

  const timeTaken = ((Date.now() - start) / 1000).toFixed(2) + "s";

  if (results.error) {
    return res.json({
      url,
      result: "failed",
      error: results.error,
      time_taken: timeTaken,
    });
  }

  const foundKeywords = Object.keys(results).filter((k) => results[k]);

  return res.json({
    url,
    result: "success",
    found_keywords: foundKeywords,
    any_keyword_found: foundKeywords.length > 0,
    time_taken: timeTaken,
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(` Server running at http://127.0.0.1:${PORT}`);
});