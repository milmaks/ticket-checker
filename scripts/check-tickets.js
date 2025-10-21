#!/usr/bin/env node
const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const STATE_FILE = path.join(__dirname, '..', '.ticket-state');

function getLastState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return fs.readFileSync(STATE_FILE, 'utf8').trim();
    }
  } catch (err) {
    console.log('Could not read state file:', err.message);
  }
  return null;
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, state);
  } catch (err) {
    console.log('Could not save state file:', err.message);
  }
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram not configured. Skipping notification.');
    return;
  }
  const bot = new TelegramBot(token);
  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('https://ticketplay.rs/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'KUPI KARTU' }).click();
    const email = process.env.EMAIL || '';
    const pw = process.env.PW || '';
    if (!email || !pw) {
      throw new Error('EMAIL or PW not set in environment');
    }
    await page.getByRole('textbox', { name: 'Unesite e-mail adresu' }).fill(email);
    await page.getByRole('textbox', { name: '••••••••' }).fill(pw);
    await page.getByRole('button', { name: 'Prijavi se' }).click();

    // Wait for page to load and potential state update
    await page.waitForTimeout(3000);

    // Try multiple selectors to find the sale status
    let noSale = false;
    let statusText = '';
    
    try {
      // First try: look for the specific "Nema prodaje" text
      const noSaleLocator = page.locator('div').filter({ hasText: 'Nema prodaje' });
      if (await noSaleLocator.count() > 0) {
        statusText = await noSaleLocator.nth(0).textContent() || '';
        noSale = statusText.includes('Trenutno nema aktivnih prodaja');
      } else {
        // Second try: look for any text containing "nema aktivnih prodaja"
        const generalLocator = page.locator('*').filter({ hasText: 'nema aktivnih prodaja' });
        if (await generalLocator.count() > 0) {
          statusText = await generalLocator.nth(0).textContent() || '';
          noSale = true;
        } else {
          // Third try: look for any text containing "prodaja"
          const saleLocator = page.locator('*').filter({ hasText: 'prodaja' });
          if (await saleLocator.count() > 0) {
            statusText = await saleLocator.nth(0).textContent() || '';
            noSale = statusText.includes('nema') || statusText.includes('Nema');
          }
        }
      }
    } catch (err) {
      console.log('Error finding sale status:', err.message);
      // If we can't determine the status, assume no sale to avoid false positives
      noSale = true;
      statusText = 'Unable to determine status';
    }
    
    const currentState = noSale ? 'no-sale' : 'sale-available';
    const lastState = getLastState();
    
    console.log(`Status text found: "${statusText}"`);
    console.log(`Current state: ${currentState}, Last state: ${lastState || 'unknown'}`);
    
    if (currentState !== lastState) {
      if (noSale) {
        console.log('No sale detected (state change).');
      } else {
        console.log('Sale may be active! Sending notification...');
        await sendTelegram('🎟️ <b>Tickets might be available on TicketPlay!</b>\n\nCheck now: https://ticketplay.rs/');
      }
      saveState(currentState);
    } else {
      console.log('No state change detected. Skipping notification.');
    }
  } catch (err) {
    console.error('Checker failed:', err.message);
    await sendTelegram(`⚠️ Ticket checker error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();


