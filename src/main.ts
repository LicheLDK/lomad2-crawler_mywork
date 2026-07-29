import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './config/validate-production-secrets';

// Windows에서 IPv6 dual-stack 조회가 ENOBUFS를 유발하는 경우 완화
dns.setDefaultResultOrder('ipv4first');
assertProductionSecrets();

const SWAGGER_UI_CDN =
  'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.8';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JS 번들 없이 동작하는 경량 API 문서 (Cursor/Chrome 모두 안정) */
function buildSimpleDocsHtml(document: OpenAPIObject): string {
  const paths = document.paths || {};
  const sections: string[] = [];

  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
    ] as const) {
      const op = (item as Record<string, unknown>)[method] as
        | {
            summary?: string;
            tags?: string[];
            operationId?: string;
          }
        | undefined;
      if (!op) continue;
      const tag = op.tags?.[0] || 'default';
      const summary = op.summary || op.operationId || '';
      sections.push(`
        <article class="endpoint">
          <div class="row">
            <span class="method method-${method}">${method.toUpperCase()}</span>
            <code class="path">${escapeHtml(path)}</code>
          </div>
          <div class="meta">
            <span class="tag">${escapeHtml(tag)}</span>
            <span class="summary">${escapeHtml(summary)}</span>
          </div>
        </article>`);
    }
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.info?.title || 'API Docs')}</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --card: #fff;
      --text: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Malgun Gothic", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      background: linear-gradient(120deg, #0f766e, #115e59);
      color: #fff;
      padding: 28px 24px;
    }
    header h1 { margin: 0 0 8px; font-size: 1.6rem; }
    header p { margin: 0; opacity: 0.92; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 20px 16px 40px; }
    .actions {
      display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0 20px;
    }
    .actions a {
      display: inline-block;
      padding: 10px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary { background: #fff; color: var(--accent); border: 1px solid #99f6e4; }
    .note {
      background: #ecfeff;
      border: 1px solid #a5f3fc;
      color: #155e75;
      padding: 12px 14px;
      border-radius: 8px;
      margin-bottom: 18px;
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .endpoint {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 10px;
    }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .method {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      color: #fff;
      min-width: 64px;
      text-align: center;
    }
    .method-get { background: #2563eb; }
    .method-post { background: #16a34a; }
    .method-put, .method-patch { background: #d97706; }
    .method-delete { background: #dc2626; }
    .path { font-size: 0.95rem; }
    .meta { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 0.9rem; }
    .tag {
      background: #f3f4f6;
      border-radius: 999px;
      padding: 2px 8px;
      color: #374151;
    }
    code.block {
      display: block;
      background: #111827;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      font-size: 0.85rem;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>${escapeHtml(document.info?.title || 'API Docs')}</h1>
      <p>${escapeHtml(document.info?.description || '')}</p>
    </div>
  </header>
  <div class="wrap">
    <div class="actions">
      <a class="btn-primary" href="/docs/swagger">Swagger UI 열기 (Chrome 권장)</a>
      <a class="btn-secondary" href="/docs-json" target="_blank">OpenAPI JSON</a>
      <a class="btn-secondary" href="/api/health" target="_blank">Health Check</a>
    </div>
    <div class="note">
      Cursor 내장 브라우저/미리보기는 대용량 Swagger JS 로딩이 불안정할 수 있습니다.<br/>
      API 목록은 이 페이지에서 확인하고, Try it out 은 Chrome의 Swagger UI를 사용하세요.<br/>
      API Key 헤더: <strong>x-api-key</strong>
    </div>
    <h2>Endpoints</h2>
    ${sections.join('\n') || '<p>등록된 API가 없습니다.</p>'}
    <h2>호출 예시</h2>
    <code class="block">curl -X POST http://127.0.0.1:3100/api/search ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: change-me-api-key" ^
  -d "{\\"keyword\\":\\"시몬스 침대\\"}"</code>
  </div>
</body>
</html>`;
}

function buildSwaggerUiHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Search Crawler Server API - Swagger</title>
  <link rel="stylesheet" type="text/css" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    #swagger-status { margin: 16px; font-family: sans-serif; color: #555; }
    #swagger-error {
      display: none; margin: 16px; padding: 12px;
      border: 1px solid #f5c2c7; background: #f8d7da; color: #842029;
      font-family: sans-serif; white-space: pre-wrap;
    }
    .back { display:inline-block; margin: 12px 16px; font-family: sans-serif; }
  </style>
</head>
<body>
  <a class="back" href="/docs">← 간단 문서로</a>
  <div id="swagger-status">Swagger UI 로딩 중...</div>
  <div id="swagger-error"></div>
  <div id="swagger-ui"></div>
  <script>
    function setStatus(text) {
      var el = document.getElementById('swagger-status');
      if (el) el.textContent = text || '';
    }
    function showError(message) {
      setStatus('');
      var el = document.getElementById('swagger-error');
      el.style.display = 'block';
      el.textContent = message;
    }
    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = function () { resolve(src); };
        script.onerror = function () { reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(script);
      });
    }
    function initSwagger() {
      window.ui = SwaggerUIBundle({
        url: '/docs-json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        deepLinking: true,
      });
      setStatus('');
    }
    var sources = [
      '${SWAGGER_UI_CDN}/swagger-ui-bundle.js',
      '/swagger-assets/swagger-ui-bundle.js'
    ];
    (async function () {
      var lastError = null;
      for (var attempt = 1; attempt <= 5; attempt++) {
        for (var i = 0; i < sources.length; i++) {
          try {
            setStatus('Swagger UI 로딩 중... (시도 ' + attempt + ')');
            await loadScript(sources[i]);
            initSwagger();
            return;
          } catch (err) {
            lastError = err;
            await sleep(400 * attempt);
          }
        }
      }
      showError(
        'Swagger UI 로드 실패.\\n' +
        (lastError && lastError.message ? lastError.message : String(lastError)) +
        '\\n\\n간단 문서를 사용하세요: http://127.0.0.1:3100/docs\\n' +
        '또는 Chrome에서 이 페이지를 새로고침 하세요.'
      );
    })();
  </script>
</body>
</html>`;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
      'http://127.0.0.1:8080',
      'http://localhost:8080',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Search Crawler Server')
    .setDescription(
      '가구 렌탈 상품의 중고거래 사이트 판매 탐지 검색 API (Laravel 연동)',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addSecurityRequirements('api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);

  SwaggerModule.setup('docs', app, document, {
    ui: false,
    raw: ['json'],
    jsonDocumentUrl: 'docs-json',
  });

   
  const swaggerAssetsPath = require('swagger-ui-dist/absolute-path.js')() as string;
  app.useStaticAssets(swaggerAssetsPath, {
    prefix: '/swagger-assets/',
  });

  const simpleHtml = buildSimpleDocsHtml(document);
  const swaggerHtml = buildSwaggerUiHtml();
  const http = app.getHttpAdapter().getInstance();

  http.get('/docs', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
    res.type('html').send(simpleHtml);
  });
  http.get('/docs/', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
    res.type('html').send(simpleHtml);
  });
  http.get('/docs/swagger', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
    res.type('html').send(swaggerHtml);
  });

  const port = process.env.PORT || 3100;
  await app.listen(port, '0.0.0.0');
   
  console.log(`Search Crawler API listening on :${port}`);
  console.log(`API docs: http://127.0.0.1:${port}/docs`);
  console.log(`Swagger UI: http://127.0.0.1:${port}/docs/swagger`);
}

bootstrap();
