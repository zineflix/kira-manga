import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  
  // --- Root route ---
  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro: "Welcome to the Mangapill provider",
      routes: ['/:query', '/info?id=...', '/read?chapterId=...'],
      documentation: 'https://docs.consumet.org/#tag/mangapill',
    });
  });

  // --- Search manga ---
  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.params as { query: string }).query;
    try {
      const url = `https://mangapill.com/search?query=${encodeURIComponent(query)}`;
      const html = await fetch(url).then(res => res.text());
      const $ = cheerio.load(html);

      const results: any[] = [];
      $('div.manga-item').each((i, el) => {
        const title = $(el).find('h3 a').text().trim();
        const mangaUrl = $(el).find('h3 a').attr('href');
        const id = mangaUrl?.split('/').pop();
        const image = $(el).find('img').attr('src');

        if (title && id) {
          results.push({ id, title, image, url: mangaUrl });
        }
      });

      reply.status(200).send({ results });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Search failed' });
    }
  });

  // --- Manga info / chapters ---
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.query as { id: string }).id;
    if (!id) return reply.status(400).send({ message: 'id is required' });

    try {
      const url = `https://mangapill.com/manga/${id}`;
      const html = await fetch(url).then(res => res.text());
      const $ = cheerio.load(html);

      const chapters: any[] = [];
      $('div.chapter-list a').each((i, el) => {
        const chapterTitle = $(el).text().trim();
        const chapterUrl = $(el).attr('href');
        const chapterId = chapterUrl?.split('/').pop();

        if (chapterId && chapterTitle) {
          chapters.push({ id: chapterId, title: chapterTitle, url: chapterUrl });
        }
      });

      reply.status(200).send({ chapters });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Failed to fetch manga info' });
    }
  });

  // --- Read chapter pages ---
  fastify.get('/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const chapterId = (request.query as { chapterId: string }).chapterId;
    if (!chapterId) return reply.status(400).send({ message: 'chapterId is required' });

    try {
      const url = `https://mangapill.com/chapters/${chapterId}`;
      const html = await fetch(url).then(res => res.text());
      const $ = cheerio.load(html);

      const images: string[] = [];
      $('img.page').each((i, el) => {
        const src = $(el).attr('src');
        if (src) images.push(src);
      });

      reply.status(200).send({ images });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Failed to fetch chapter pages' });
    }
  });
};

export default routes;
