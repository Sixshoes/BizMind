import appPromise from '../server.ts';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
