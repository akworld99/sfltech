import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upstreamUrl, rewriteHtml, rewriteLocation, isResourcesPath } from '../src/lib/mirror.js';

test('upstream URL mapping', () => {
  assert.equal(upstreamUrl(undefined, ''), 'https://www.sfltech.ai/resources');
  assert.equal(upstreamUrl('rewiring-the-road', ''), 'https://www.sfltech.ai/resources/rewiring-the-road');
  assert.equal(upstreamUrl('', '?type=case-study'), 'https://www.sfltech.ai/resources?type=case-study');
});

test('resources path detection', () => {
  assert.ok(isResourcesPath('resources'));
  assert.ok(isResourcesPath('resources/x'));
  assert.ok(isResourcesPath('resources?type=video'));
  assert.ok(isResourcesPath('resources#top'));
  assert.ok(!isResourcesPath('resources-copy'));
  assert.ok(!isResourcesPath('contact-us'));
});

test('links outside /resources go to sfltech.ai, inside stay relative', () => {
  const html = `<a href="/">Home</a><a href="/contact-us">C</a><a href="/jointventures#jvtnp">J</a>
<a href="/resources">R</a><a href="/resources?type=insight">F</a><a href="/resources/rewiring-the-road">A</a>
<a href="/resources-copy">X</a><a href="//cdn.example.com/a.js">P</a><a href="https://x.com/y">Abs</a>
<a href="mailto:connectwithus@sfltech.ai">M</a><a href="#top">H</a><img src="/logo.png"><form action="/search"></form>`;
  const out = rewriteHtml(html);
  assert.match(out, /href="https:\/\/www\.sfltech\.ai\/"/);
  assert.match(out, /href="https:\/\/www\.sfltech\.ai\/contact-us"/);
  assert.match(out, /href="https:\/\/www\.sfltech\.ai\/jointventures#jvtnp"/);
  assert.match(out, /href="\/resources"/);
  assert.match(out, /href="\/resources\?type=insight"/);
  assert.match(out, /href="\/resources\/rewiring-the-road"/);
  assert.match(out, /href="https:\/\/www\.sfltech\.ai\/resources-copy"/);
  assert.match(out, /href="\/\/cdn\.example\.com\/a\.js"/);
  assert.match(out, /href="https:\/\/x\.com\/y"/);
  assert.match(out, /href="mailto:connectwithus@sfltech\.ai"/);
  assert.match(out, /href="#top"/);
  assert.match(out, /src="https:\/\/www\.sfltech\.ai\/logo\.png"/);
  assert.match(out, /action="https:\/\/www\.sfltech\.ai\/search"/);
});

test('redirect locations', () => {
  assert.equal(rewriteLocation('https://www.sfltech.ai/resources/new-slug'), '/resources/new-slug');
  assert.equal(rewriteLocation('/resources/a?b=1'), '/resources/a?b=1');
  assert.equal(rewriteLocation('https://sfltech.ai/resources'), '/resources');
  assert.equal(rewriteLocation('/contact-us'), 'https://www.sfltech.ai/contact-us');
  assert.equal(rewriteLocation('https://other.com/x'), 'https://other.com/x');
});
