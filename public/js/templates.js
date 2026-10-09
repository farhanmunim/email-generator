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
      B('footer', { company: 'ACME Inc.', address: '123 Example Street, City', note: 'You received this email because you signed up at example.com.', unsubscribeUrl: 'https://example.com/unsubscribe', paddingTop: 12, paddingBottom: 32 }),
    ], { subject: 'Welcome aboard — let’s get you set up', preheader: 'Your account is ready — here’s how to get started.' }),
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
      B('columns', {
        c1Title: 'A smaller story', c1Text: 'One or two lines that explain why this one matters to readers.', c1Label: 'Read more', c1Url: 'https://example.com/one',
        c2Title: 'Another good read', c2Text: 'A second short summary for readers who like to skim.', c2Label: 'Read more', c2Url: 'https://example.com/two',
        titleSize: 17, paddingBottom: 28,
      }),
      B('quote', { quote: '“The only newsletter I read start to finish.”', author: 'A happy reader', role: 'Subscriber since issue 1', accent: '#111827', fontFamily: 'georgia', paddingBottom: 32 }),
      B('footer', { company: 'The Monthly Brief', address: '123 Example Street, City', note: 'You’re receiving this because you subscribed at example.com.', unsubscribeUrl: 'https://example.com/unsubscribe', browserUrl: 'https://example.com/view', bg: '#f9fafb' }),
    ], { subject: 'The Monthly Brief #24: the big idea', preheader: 'Issue 24: the big idea, plus quick reads.' }),
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
      B('social', { website: 'https://example.com', instagram: 'https://instagram.com/example', x: 'https://x.com/example', bg: '#f3f4f6', paddingTop: 20, paddingBottom: 0 }),
      B('footer', { company: 'ACME Inc.', address: '123 Example Street, City', note: '', unsubscribeUrl: 'https://example.com/unsubscribe', color: '#6b7280', bg: '#f3f4f6', paddingTop: 8, paddingBottom: 24 }),
    ], { subject: 'Summer sale: up to 50% off, this weekend only', preheader: 'Up to 50% off — this weekend only.' }),
  },
  {
    id: 'launch',
    name: 'Product launch (dark)',
    description: 'Dark, modern announcement with a left-aligned headline and feature list.',
    build: () => createDoc('Product launch', [
      B('heading', { text: 'ORBIT', level: 3, fontSize: 14, color: '#7c9cff', paddingTop: 36, paddingBottom: 0 }),
      B('heading', { text: 'Meet Orbit 2.0', fontSize: 44, lineHeight: 1.1, paddingTop: 16, paddingBottom: 12 }),
      B('text', { text: 'A faster, calmer way to run your team’s day. Rebuilt from the ground up — and it’s live today.', fontSize: 18, paddingBottom: 8 }),
      B('button', { text: 'See what’s new', url: 'https://example.com/orbit', fill: '#7c9cff', textColor: '#0b0f1a', radius: 8, align: 'left', paddingTop: 16, paddingBottom: 32 }),
      B('image', { src: hero('Orbit 2.0', '1e293b', '7c9cff', 600, 320), alt: 'Orbit 2.0 dashboard', radius: 12, paddingLeft: 32, paddingRight: 32, paddingTop: 0, paddingBottom: 0 }),
      B('divider', { color: '#1f2937', paddingTop: 36, paddingBottom: 8 }),
      B('heading', { text: 'Faster. Calmer. Yours.', level: 2, fontSize: 22, paddingTop: 16, paddingBottom: 8 }),
      B('text', { text: '• Instant sync across every device\n• A focus mode that mutes the noise\n• Shortcuts for everything you do twice', lineHeight: 1.8, paddingBottom: 36 }),
      B('quote', { quote: '“Orbit gave us back an hour every single day.”', author: 'Priya Shah', role: 'Head of Ops, Northwind', accent: '#7c9cff', fontSize: 18, paddingTop: 0, paddingBottom: 36 }),
      B('footer', { company: 'Orbit Labs', address: '123 Example Street, City', note: '', unsubscribeUrl: 'https://example.com/unsubscribe', color: '#6b7280', bg: '#070a12' }),
    ], { subject: 'Meet Orbit 2.0',  bg: '#05070d', contentBg: '#0b0f1a', textColor: '#a8b0c3', headingColor: '#ffffff', linkColor: '#7c9cff', fontFamily: 'system', outerPadding: 32, preheader: 'Orbit 2.0 is here — faster, calmer, yours.' }),
  },
  {
    id: 'invitation',
    name: 'Event invitation',
    description: 'Warm, centred serif invitation with date, place and an RSVP button.',
    build: () => createDoc('Event invitation', [
      B('text', { text: 'YOU’RE INVITED', fontSize: 12, align: 'center', color: '#9a3412', paddingTop: 52, paddingBottom: 4 }),
      B('heading', { text: 'Autumn Supper Club', fontSize: 40, align: 'center', paddingTop: 4, paddingBottom: 12 }),
      B('divider', { width: 20, color: '#9a3412', thickness: 2, paddingTop: 8, paddingBottom: 16 }),
      B('text', { text: '**Saturday, 12 October · 7:00 PM**\nThe Garden Room, 14 Elm Street', fontSize: 18, align: 'center', color: '#3b2f2f', paddingBottom: 20 }),
      B('image', { src: hero('Garden Room', 'ede0cf', '9a3412', 500, 280), alt: 'The Garden Room set for dinner', paddingLeft: 40, paddingRight: 40, paddingBottom: 4 }),
      B('text', { text: 'Join us for a long table, seasonal food and good company. Seats are limited, so please let us know by 5 October.', align: 'center', paddingTop: 20, paddingLeft: 48, paddingRight: 48 }),
      B('button', { text: 'RSVP by 5 October', url: 'https://example.com/rsvp', fill: '#9a3412', radius: 2, fontFamily: 'georgia', paddingTop: 12, paddingBottom: 48 }),
      B('footer', { company: 'The Garden Room', address: '14 Elm Street, City', note: 'Can’t make it? Let us know and we’ll save you a seat next time.', unsubscribeUrl: 'https://example.com/unsubscribe', color: '#8a7a70', bg: '#f5efe6' }),
    ], { subject: 'You’re invited: Autumn Supper Club, 12 October',  width: 560, bg: '#f5efe6', contentBg: '#fffdf8', textColor: '#5a4a42', headingColor: '#3b2f2f', linkColor: '#9a3412', fontFamily: 'georgia', outerPadding: 32, preheader: 'Saturday 12 October at The Garden Room — RSVP by 5 October.' }),
  },
  {
    id: 'letter',
    name: 'Personal letter',
    description: 'Text-only note that reads like a message from a person. Great deliverability.',
    build: () => createDoc('Personal letter', [
      B('text', { text: 'Hi {{ first_name }},', fontSize: 17, paddingTop: 40, paddingBottom: 4 }),
      B('text', { text: 'I wanted to write to you personally to say thank you. A year ago this was just an idea, and today thousands of people use it every day — including you.\n\nHere’s what we’re working on next, and I’d love to hear what you think. Just hit reply; I read every response.', fontSize: 17, lineHeight: 1.7 }),
      B('text', { text: 'Warmly,\n**Sam Rivera**\nFounder, Acme', fontSize: 17, lineHeight: 1.7, paddingTop: 12 }),
      B('text', { text: 'P.S. If you’d like early access to what’s next, [join the beta here](https://example.com/beta).', fontSize: 17, lineHeight: 1.7, paddingTop: 16, paddingBottom: 32 }),
      B('divider', { color: '#e5e7eb', paddingTop: 0, paddingBottom: 12 }),
      B('footer', { company: 'Acme Inc.', address: '123 Example Street, City', note: '', unsubscribeUrl: 'https://example.com/unsubscribe', align: 'left', paddingTop: 0, paddingBottom: 32 }),
    ], { subject: 'A quick personal note',  width: 520, bg: '#ffffff', contentBg: '#ffffff', textColor: '#1f2937', headingColor: '#111827', linkColor: '#2563eb', fontFamily: 'system', outerPadding: 8, preheader: 'A short personal note — and what’s next.' }),
  },
];
