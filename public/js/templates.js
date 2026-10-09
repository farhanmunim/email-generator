// Starter templates. Hero images use placehold.co purely as sample content —
// users replace them with their own image URLs.

import { createDoc, createBlock as B } from './blocks.js';

const hero = (label, bg, fg, w = 600, h = 280) =>
  `https://placehold.co/${w * 2}x${h * 2}/${bg}/${fg}/png?text=${encodeURIComponent(label)}`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank canvas',
    description: 'Start from scratch.',
    build: () => createDoc('Untitled email', []),
  },
  {
    id: 'welcome',
    name: 'Welcome email',
    description: 'Friendly onboarding message with a hero image and a clear call to action.',
    build: () => createDoc('Welcome email', [
      B('heading', { text: 'ACME', level: 3, fontSize: 18, align: 'center', color: '#ffffff', bg: '#111827', paddingTop: 20, paddingBottom: 20 }),
      B('image', { src: hero('Welcome aboard', 'e0e7ff', '4338ca'), alt: 'Welcome aboard', width: 100 }),
      B('heading', { text: 'Welcome aboard! 👋', align: 'center', paddingTop: 36 }),
      B('text', { text: 'Thanks for joining us. Your account is ready, and we can’t wait to see what you build.\n\nHere’s the quickest way to get started — it only takes a couple of minutes.', align: 'center', paddingBottom: 4 }),
      B('button', { text: 'Set up your account', url: 'https://example.com/start', paddingBottom: 36 }),
      B('divider'),
      B('text', { text: 'Questions? Just reply to this email — a real person will get back to you.', fontSize: 14, align: 'center', color: '#6b7280' }),
      B('text', { text: 'ACME Inc., 123 Example Street, City\n[Unsubscribe](https://example.com/unsubscribe)', fontSize: 12, align: 'center', color: '#9ca3af', paddingTop: 12, paddingBottom: 32 }),
    ], { preheader: 'Your account is ready — here’s how to get started.' }),
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Monthly roundup with a featured story and two short articles.',
    build: () => createDoc('Monthly newsletter', [
      B('heading', { text: 'The Monthly Brief', align: 'center', fontFamily: 'georgia', fontSize: 30, paddingTop: 32, paddingBottom: 4 }),
      B('text', { text: 'Issue 24 · Ideas worth your time', align: 'center', fontSize: 14, color: '#6b7280', paddingTop: 0, paddingBottom: 20 }),
      B('divider', { color: '#111827', thickness: 2, paddingTop: 0, paddingBottom: 24 }),
      B('image', { src: hero('Featured story', 'fef3c7', 'b45309', 600, 300), alt: 'Featured story', paddingLeft: 32, paddingRight: 32, radius: 8 }),
      B('heading', { text: 'This month’s big idea', level: 2, fontSize: 26, fontFamily: 'georgia', paddingTop: 24 }),
      B('text', { text: 'A short introduction to the story goes here. Keep it punchy: two or three sentences that make people want to read on.' }),
      B('button', { text: 'Read the full story', url: 'https://example.com/story', fill: '#111827', align: 'left', radius: 0, paddingTop: 8, paddingBottom: 28 }),
      B('divider'),
      B('heading', { text: 'Quick reads', level: 2, fontSize: 20, paddingTop: 20 }),
      B('text', { text: '**A smaller story title** — one line that explains why it matters. [Read more](https://example.com/one)' }),
      B('text', { text: '**Another useful link** — a second short summary for readers who skim. [Read more](https://example.com/two)', paddingBottom: 28 }),
      B('text', { text: 'You’re receiving this because you subscribed at example.com.\n[Unsubscribe](https://example.com/unsubscribe) · [View in browser](https://example.com/view)', fontSize: 12, align: 'center', color: '#9ca3af', bg: '#f9fafb', paddingTop: 24, paddingBottom: 24 }),
    ], { preheader: 'Issue 24: the big idea, plus quick reads.' }),
  },
  {
    id: 'promo',
    name: 'Product promo',
    description: 'Bold sale announcement with a high-contrast offer.',
    build: () => createDoc('Summer sale', [
      B('text', { text: 'FREE SHIPPING ON ORDERS OVER $50', fontSize: 12, align: 'center', color: '#ffffff', bg: '#be123c', paddingTop: 10, paddingBottom: 10 }),
      B('heading', { text: 'SUMMER SALE', fontSize: 44, align: 'center', paddingTop: 40, paddingBottom: 0, fontFamily: 'trebuchet' }),
      B('heading', { text: 'Up to 50% off', level: 2, fontSize: 24, align: 'center', color: '#be123c', paddingTop: 4, paddingBottom: 20 }),
      B('image', { src: hero('Featured products', 'ffe4e6', 'be123c', 600, 320), alt: 'Featured products' }),
      B('text', { text: 'Our biggest sale of the year is here. Stock up on the favourites you love before they’re gone.\n\nOffer ends Sunday at midnight.', align: 'center', paddingTop: 28 }),
      B('button', { text: 'Shop the sale', url: 'https://example.com/sale', fill: '#be123c', radius: 999, fontSize: 18, padX: 40, paddingBottom: 40 }),
      B('text', { text: 'ACME Inc., 123 Example Street, City\n[Unsubscribe](https://example.com/unsubscribe)', fontSize: 12, align: 'center', color: '#6b7280', bg: '#f3f4f6', paddingTop: 20, paddingBottom: 20 }),
    ], { preheader: 'Up to 50% off — this weekend only.' }),
  },
];
