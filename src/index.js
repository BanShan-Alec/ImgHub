// CF-ImgHub：小而快的自建图床。/file/* 读图，/api/* 管理，其余交给静态资源（上传页）
import { serveFile } from './serve.js';
import { handleApi } from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/file/')) return serveFile(request, env, ctx, url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, ctx, url);
    return env.ASSETS.fetch(request);
  },
};
