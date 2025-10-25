import axios from 'axios';
import * as cheerio from 'cheerio';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const routes = async (fastify: FastifyInstance) => {
  const baseUrl = 'https://flamecomics.xyz';

  fastify.get('/', (_, reply) => {
    reply.status(200).send({
      intro: `Welcome to the FlameComics provider @ ${baseUrl}`,
      routes: ['/:query', '/info?id={id}', '/read?chapterId={chapterId}'],
    });
  });

  fastify.get('/:query', async (req: FastifyRequest, reply: FastifyReply) => {
    const { query } = req.params as { query: string };
    const url = `${baseUrl}/search?keyword=${encodeURIComponent(query)}`;

    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const results: any[] = [];

      $('.book-item').each((_, el) => {
        results.push({
          title: $(el).find('.book-title').text(),
          url: baseUrl + $(el).find('a').attr('href'),
          image: $(el).find('img').attr('src'),
        });
      });

      reply.status(200).send(results);
    } catch (e) {
      reply.status(500).send({ message: 'Failed to fetch search results.' });
    }
  });
};

export default routes;
