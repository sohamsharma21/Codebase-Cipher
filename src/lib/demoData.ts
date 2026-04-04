import type { RepoFile, AISummary, APIEndpoint } from '@/types';
import type { Node, Edge } from '@xyflow/react';

const demoFiles: RepoFile[] = [
  { path: 'package.json', type: 'blob', content: '{\n  "name": "express",\n  "version": "4.18.2",\n  "description": "Fast, unopinionated, minimalist web framework"\n}' },
  { path: 'index.js', type: 'blob', content: "/*!\n * express\n * MIT Licensed\n */\n\n'use strict';\n\nmodule.exports = require('./lib/express');" },
  { path: 'lib/express.js', type: 'blob', content: "var bodyParser = require('body-parser');\nvar EventEmitter = require('events').EventEmitter;\nvar mixin = require('merge-descriptors');\nvar proto = require('./application');\nvar Route = require('./router/route');\nvar Router = require('./router');\nvar req = require('./request');\nvar res = require('./response');\n\nexports = module.exports = createApplication;\n\nfunction createApplication() {\n  var app = function(req, res, next) {\n    app.handle(req, res, next);\n  };\n  mixin(app, EventEmitter.prototype, false);\n  mixin(app, proto, false);\n  app.request = Object.create(req, {});\n  app.response = Object.create(res, {});\n  app.init();\n  return app;\n}" },
  { path: 'lib/application.js', type: 'blob', content: "var finalhandler = require('finalhandler');\nvar Router = require('./router');\nvar methods = require('methods');\nvar middleware = require('./middleware/init');\nvar query = require('./middleware/query');\nvar debug = require('debug')('express:application');\nvar View = require('./view');\nvar http = require('http');\nvar compileETag = require('./utils').compileETag;\n\nvar app = exports = module.exports = {};\n\napp.init = function init() {\n  this.cache = {};\n  this.engines = {};\n  this.settings = {};\n  this.defaultConfiguration();\n};\n\napp.listen = function listen() {\n  var server = http.createServer(this);\n  return server.listen.apply(server, arguments);\n};" },
  { path: 'lib/router/index.js', type: 'blob', content: "var Route = require('./route');\nvar Layer = require('./layer');\nvar methods = require('methods');\nvar mixin = require('utils-merge');\nvar debug = require('debug')('express:router');\nvar flatten = require('array-flatten');\n\nvar proto = module.exports = function(options) {\n  var opts = options || {};\n  function router(req, res, next) {\n    router.handle(req, res, next);\n  }\n  return router;\n};\n\nproto.route = function route(path) {\n  var route = new Route(path);\n  var layer = new Layer(path, {}, route.dispatch.bind(route));\n  layer.route = route;\n  this.stack.push(layer);\n  return route;\n};" },
  { path: 'lib/router/route.js', type: 'blob', content: "var debug = require('debug')('express:router:route');\nvar flatten = require('array-flatten');\nvar Layer = require('./layer');\nvar methods = require('methods');\n\nmodule.exports = Route;\n\nfunction Route(path) {\n  this.path = path;\n  this.stack = [];\n  this.methods = {};\n}" },
  { path: 'lib/router/layer.js', type: 'blob', content: "var pathRegexp = require('path-to-regexp');\nvar debug = require('debug')('express:router:layer');\n\nmodule.exports = Layer;\n\nfunction Layer(path, options, fn) {\n  this.handle = fn;\n  this.name = fn.name || '<anonymous>';\n  this.params = undefined;\n  this.path = undefined;\n  this.regexp = pathRegexp(path, this.keys = [], options);\n}" },
  { path: 'lib/request.js', type: 'blob', content: "var accepts = require('accepts');\nvar deprecate = require('depd')('express');\nvar isIP = require('net').isIP;\nvar typeis = require('type-is');\nvar http = require('http');\nvar fresh = require('fresh');\nvar parseRange = require('range-parser');\nvar parse = require('parseurl');\n\nvar req = exports = module.exports = {\n  __proto__: http.IncomingMessage.prototype\n};\n\nreq.get = req.header = function header(name) {\n  var lc = name.toLowerCase();\n  return this.headers[lc];\n};" },
  { path: 'lib/response.js', type: 'blob', content: "var contentDisposition = require('content-disposition');\nvar deprecate = require('depd')('express');\nvar encodeUrl = require('encodeurl');\nvar escapeHtml = require('escape-html');\nvar http = require('http');\nvar onFinished = require('on-finished');\nvar path = require('path');\nvar send = require('send');\nvar vary = require('vary');\n\nvar res = module.exports = {\n  __proto__: http.ServerResponse.prototype\n};\n\nres.status = function status(code) {\n  this.statusCode = code;\n  return this;\n};\n\nres.json = function json(obj) {\n  var body = JSON.stringify(obj);\n  this.set('Content-Type', 'application/json');\n  return this.send(body);\n};" },
  { path: 'lib/view.js', type: 'blob', content: "var debug = require('debug')('express:view');\nvar path = require('path');\nvar fs = require('fs');\n\nmodule.exports = View;\n\nfunction View(name, options) {\n  var opts = options || {};\n  this.defaultEngine = opts.defaultEngine;\n  this.root = opts.root;\n  this.ext = path.extname(name);\n  this.name = name;\n}" },
  { path: 'lib/utils.js', type: 'blob', content: "var Buffer = require('safe-buffer').Buffer;\nvar contentType = require('content-type');\nvar flatten = require('array-flatten');\nvar mime = require('send').mime;\nvar etag = require('etag');\nvar proxyaddr = require('proxy-addr');\nvar qs = require('qs');\n\nexports.compileETag = function(val) {\n  if (typeof val === 'function') return val;\n  switch (val) {\n    case true: return exports.wetag;\n    case false: return;\n    case 'strong': return exports.etag;\n    case 'weak': return exports.wetag;\n  }\n};" },
  { path: 'lib/middleware/init.js', type: 'blob', content: "var setPrototypeOf = require('setprototypeof');\n\nexports.init = function(app) {\n  return function expressInit(req, res, next) {\n    req.res = res;\n    res.req = req;\n    req.next = next;\n    setPrototypeOf(req, app.request);\n    setPrototypeOf(res, app.response);\n    next();\n  };\n};" },
  { path: 'lib/middleware/query.js', type: 'blob', content: "var merge = require('utils-merge');\nvar parseUrl = require('parseurl');\nvar qs = require('qs');\n\nmodule.exports = function query(options) {\n  var opts = merge({}, options);\n  var queryparse = qs.parse;\n  return function query(req, res, next) {\n    if (!req.query) {\n      var val = parseUrl(req).query;\n      req.query = queryparse(val, opts);\n    }\n    next();\n  };\n};" },
  { path: 'README.md', type: 'blob', content: '# Express\n\nFast, unopinionated, minimalist web framework for Node.js.\n\n## Installation\n\n```bash\nnpm install express\n```' },
];

const demoSummaries: Record<string, AISummary> = {
  'lib/express.js': {
    purpose: 'Main entry point that creates and configures an Express application instance.',
    explanation: 'This file exports a factory function createApplication() that creates the core Express app object. It mixes in EventEmitter for event handling, applies the application prototype for routing and middleware, and sets up request/response prototypes.',
    dependencies: ['body-parser', 'merge-descriptors', './application', './router', './request', './response'],
    type: 'service',
    complexity: 'high',
  },
  'lib/application.js': {
    purpose: 'Defines the Express application prototype with core methods like listen(), set(), and use().',
    explanation: 'This module provides the main app object that Express applications extend. It handles server creation via http.createServer, manages settings and view engines, and delegates routing to the Router module. The init() method sets up default configuration.',
    dependencies: ['finalhandler', './router', 'methods', './middleware/init', './view', 'http'],
    type: 'service',
    complexity: 'high',
  },
  'lib/router/index.js': {
    purpose: 'Implements the Express Router for matching and dispatching HTTP requests to handlers.',
    explanation: 'The Router is the core routing engine that manages a stack of Layer objects. Each layer wraps a Route and handles path matching using path-to-regexp. The router processes middleware and route handlers in order.',
    dependencies: ['./route', './layer', 'methods', 'utils-merge', 'array-flatten'],
    type: 'service',
    complexity: 'high',
  },
  'lib/router/route.js': {
    purpose: 'Represents a single route that can handle multiple HTTP methods.',
    explanation: 'A Route stores a stack of handler layers for a specific path. It supports all HTTP methods and dispatches requests to the appropriate handler based on the request method. Each method handler is wrapped in a Layer.',
    dependencies: ['./layer', 'methods', 'array-flatten'],
    type: 'model',
    complexity: 'medium',
  },
  'lib/router/layer.js': {
    purpose: 'Wraps a route handler with path matching capabilities using regular expressions.',
    explanation: 'Layer is a low-level construct that pairs a handler function with a path-matching regexp. It extracts URL parameters and determines if a given request path matches the layer pattern.',
    dependencies: ['path-to-regexp'],
    type: 'utility',
    complexity: 'medium',
  },
  'lib/request.js': {
    purpose: 'Extends Node.js IncomingMessage with Express-specific request utilities.',
    explanation: 'This module augments the HTTP request object with convenience methods for content negotiation (accepts), type checking (type-is), header access, and URL parsing. It provides the req object API that Express users interact with.',
    dependencies: ['accepts', 'type-is', 'fresh', 'range-parser', 'parseurl'],
    type: 'utility',
    complexity: 'medium',
  },
  'lib/response.js': {
    purpose: 'Extends Node.js ServerResponse with Express-specific response methods like json(), send(), and redirect().',
    explanation: 'This module provides the rich response API including status(), json(), send(), redirect(), and render(). It handles content-type negotiation, ETag generation, and streaming file responses via the send library.',
    dependencies: ['content-disposition', 'encodeurl', 'escape-html', 'on-finished', 'send', 'vary'],
    type: 'utility',
    complexity: 'high',
  },
  'lib/view.js': {
    purpose: 'Manages template engine rendering and view file resolution.',
    explanation: 'The View class resolves template file paths based on the configured views directory and file extension. It integrates with template engines registered via app.engine() to render HTML responses.',
    dependencies: ['path', 'fs'],
    type: 'utility',
    complexity: 'low',
  },
  'lib/utils.js': {
    purpose: 'Collection of internal utility functions for ETag compilation, content type handling, and trust proxy evaluation.',
    explanation: 'Provides shared helper functions used across the Express codebase including ETag generation strategies, MIME type lookups, and query string parsing configuration.',
    dependencies: ['safe-buffer', 'content-type', 'etag', 'proxy-addr', 'qs'],
    type: 'utility',
    complexity: 'low',
  },
  'lib/middleware/init.js': {
    purpose: 'Express initialization middleware that sets up request and response prototypes.',
    explanation: 'This middleware runs on every request to link req.res and res.req cross-references and set the correct prototypes for Express-enhanced request/response objects.',
    dependencies: ['setprototypeof'],
    type: 'component',
    complexity: 'low',
  },
  'lib/middleware/query.js': {
    purpose: 'Built-in middleware that parses URL query strings into req.query.',
    explanation: 'Uses the qs library to parse the URL query string and attach the result to req.query. This middleware runs automatically for all Express applications.',
    dependencies: ['utils-merge', 'parseurl', 'qs'],
    type: 'component',
    complexity: 'low',
  },
  'index.js': {
    purpose: 'Package entry point that re-exports the Express module from lib/express.',
    explanation: 'Simple re-export file that points to the main Express factory function in lib/express.js. This is the file that gets loaded when users require("express").',
    dependencies: ['./lib/express'],
    type: 'config',
    complexity: 'low',
  },
  'package.json': {
    purpose: 'NPM package manifest defining Express metadata, dependencies, and scripts.',
    explanation: 'Declares the package name, version, entry point, and all runtime/dev dependencies for the Express framework.',
    dependencies: [],
    type: 'config',
    complexity: 'low',
  },
  'README.md': {
    purpose: 'Documentation providing installation instructions and usage examples for Express.',
    explanation: 'The main README file with badges, quick start guide, and links to the full documentation website.',
    dependencies: [],
    type: 'other',
    complexity: 'low',
  },
};

export function getDemoNodes(): Node[] {
  const positions: Record<string, { x: number; y: number }> = {
    'index.js': { x: 400, y: 0 },
    'lib/express.js': { x: 400, y: 120 },
    'lib/application.js': { x: 200, y: 260 },
    'lib/router/index.js': { x: 600, y: 260 },
    'lib/request.js': { x: 50, y: 400 },
    'lib/response.js': { x: 250, y: 400 },
    'lib/view.js': { x: 450, y: 400 },
    'lib/utils.js': { x: 650, y: 400 },
    'lib/router/route.js': { x: 550, y: 400 },
    'lib/router/layer.js': { x: 750, y: 400 },
    'lib/middleware/init.js': { x: 100, y: 540 },
    'lib/middleware/query.js': { x: 350, y: 540 },
    'package.json': { x: 750, y: 120 },
    'README.md': { x: 50, y: 120 },
  };

  return demoFiles.map(f => ({
    id: f.path,
    type: 'fileNode',
    position: positions[f.path] || { x: Math.random() * 800, y: Math.random() * 600 },
    data: { label: f.path, filePath: f.path },
  }));
}

export function getDemoEdges(): Edge[] {
  return [
    { id: 'e1', source: 'index.js', target: 'lib/express.js', animated: true },
    { id: 'e2', source: 'lib/express.js', target: 'lib/application.js', animated: true },
    { id: 'e3', source: 'lib/express.js', target: 'lib/router/index.js', animated: true },
    { id: 'e4', source: 'lib/express.js', target: 'lib/request.js', animated: true },
    { id: 'e5', source: 'lib/express.js', target: 'lib/response.js', animated: true },
    { id: 'e6', source: 'lib/application.js', target: 'lib/router/index.js', animated: true },
    { id: 'e7', source: 'lib/application.js', target: 'lib/middleware/init.js', animated: true },
    { id: 'e8', source: 'lib/application.js', target: 'lib/middleware/query.js', animated: true },
    { id: 'e9', source: 'lib/application.js', target: 'lib/view.js', animated: true },
    { id: 'e10', source: 'lib/application.js', target: 'lib/utils.js', animated: true },
    { id: 'e11', source: 'lib/router/index.js', target: 'lib/router/route.js', animated: true },
    { id: 'e12', source: 'lib/router/index.js', target: 'lib/router/layer.js', animated: true },
    { id: 'e13', source: 'lib/router/route.js', target: 'lib/router/layer.js', animated: true },
  ];
}

export function getDemoFiles(): RepoFile[] {
  return demoFiles;
}

export function getDemoSummary(path: string): AISummary | null {
  return demoSummaries[path] || null;
}

export function getDemoEndpoints(): APIEndpoint[] {
  return [];
}

export const DEMO_REPO_INFO = {
  owner: 'expressjs',
  repo: 'express',
  stars: 64800,
  description: 'Fast, unopinionated, minimalist web framework for node.',
};
