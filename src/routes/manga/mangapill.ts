import axios from "axios";
import * as cheerio from "cheerio";

export class MangaPill {
  baseUrl = "https://mangapill.com";

  async search(query: string) {
    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const results: any[] = [];
      $("a[href^='/manga/']").each((_, el) => {
        const title = $(el).find("p").text().trim();
        const href = $(el).attr("href");
        const image = $(el).find("img").attr("src");

        if (title && href && image) {
          results.push({
            id: href,
            title,
            image,
            url: this.baseUrl + href,
          });
        }
      });

      return results;
    } catch (error) {
      console.error("MangaPill search error:", error);
      return [];
    }
  }

  async fetchMangaInfo(id: string) {
    try {
      const url = `${this.baseUrl}${id}`;
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const title = $("h1").first().text().trim();
      const image = $("img").first().attr("src");
      const description = $("p.text-base").first().text().trim();

      const chapters: any[] = [];
      $("a.border.border-border").toArray().reverse().forEach((el) => {
        const chapterTitle = $(el).text().trim();
        const chapterId = $(el).attr("href");
        if (chapterId)
          chapters.push({
            id: chapterId,
            title: chapterTitle,
            url: this.baseUrl + chapterId,
          });
      });

      return {
        title,
        image,
        description,
        chapters,
        url,
      };
    } catch (error) {
      console.error("MangaPill manga info error:", error);
      return null;
    }
  }

  async fetchChapterPages(chapterId: string) {
    try {
      const url = `${this.baseUrl}${chapterId}`;
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const pages: string[] = [];
      $("img.js-page").each((_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src") || "";
        if (src) pages.push(src);
      });

      return {
        chapterId,
        pages,
      };
    } catch (error) {
      console.error("MangaPill chapter fetch error:", error);
      return { chapterId, pages: [] };
    }
  }
}

export default new MangaPill();
