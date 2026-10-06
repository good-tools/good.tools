import { describe, expect, it } from 'vitest'
import { alternatingCase, convertCase, inverseCase, sentenceCase, splitWords, titleCase } from './case'

describe('splitWords', () => {
  it.each([
    ['XMLHttpRequest', ['xml', 'http', 'request']],
    ['getHTTPSUrl', ['get', 'https', 'url']],
    ['IOError', ['io', 'error']],
    ['userID', ['user', 'id']],
    ['fooBarBaz', ['foo', 'bar', 'baz']],
    ['FooBar', ['foo', 'bar']],
    ['foo_bar_baz', ['foo', 'bar', 'baz']],
    ['FOO_BAR', ['foo', 'bar']],
    ['foo-bar', ['foo', 'bar']],
    ['foo.bar/baz', ['foo', 'bar', 'baz']],
    ['base64Encode', ['base64', 'encode']],
    ['HTML5Parser', ['html5', 'parser']],
    ['  The quick, brown fox!  ', ['the', 'quick', 'brown', 'fox']],
    ["don't stop", ['dont', 'stop']],
    ['größeÄnderung', ['größe', 'änderung']],
    ['ÉcoleNormale', ['école', 'normale']],
    ['привет_мир', ['привет', 'мир']],
    ['', []],
    ['--__..', []],
  ])('%j', (input, words) => {
    expect(splitWords(input)).toEqual(words)
  })
})

describe('identifier cases', () => {
  const t = (id: Parameters<typeof convertCase>[0]) => convertCase(id, 'XMLHttpRequest handler')
  it('joins words', () => {
    expect(t('camel')).toBe('xmlHttpRequestHandler')
    expect(t('pascal')).toBe('XmlHttpRequestHandler')
    expect(t('snake')).toBe('xml_http_request_handler')
    expect(t('constant')).toBe('XML_HTTP_REQUEST_HANDLER')
    expect(t('kebab')).toBe('xml-http-request-handler')
    expect(t('dot')).toBe('xml.http.request.handler')
    expect(t('path')).toBe('xml/http/request/handler')
  })
  it('converts each line separately when per-line', () => {
    expect(convertCase('snake', 'fooBar\nbazQux', true)).toBe('foo_bar\nbaz_qux')
    expect(convertCase('snake', 'fooBar\nbazQux')).toBe('foo_bar_baz_qux')
  })
})

describe('text cases', () => {
  it('title case keeps small words lowercase except at edges and after breaks', () => {
    expect(titleCase('the lord of the rings')).toBe('The Lord of the Rings')
    expect(titleCase('star wars: a new hope')).toBe('Star Wars: A New Hope')
    expect(titleCase('what are you looking at')).toBe('What Are You Looking At')
    expect(titleCase('an up-to-date guide')).toBe('An Up-to-Date Guide')
    expect(titleCase('my iPhone is NEW')).toBe('My iPhone Is New')
  })
  it('sentence case', () => {
    expect(sentenceCase('HELLO THERE. how ARE you? "fine"')).toBe('Hello there. How are you? "Fine"')
    expect(sentenceCase('one\ntwo')).toBe('One\nTwo')
  })
  it('alternating and inverse', () => {
    expect(alternatingCase('hello world')).toBe('hElLo WoRlD')
    expect(inverseCase('Hello World')).toBe('hELLO wORLD')
  })
  it('upper and lower', () => {
    expect(convertCase('upper', 'straße')).toBe('STRASSE')
    expect(convertCase('lower', 'ÀB')).toBe('àb')
  })
})
