import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

test('test', async ({ page }) => {
  await page.goto('https://ticketplay.rs/');
  await page.getByRole('button', { name: 'KUPI KARTU' }).click();
  await page.getByRole('textbox', { name: 'Unesite e-mail adresu' }).fill(process.env.EMAIL || '');
  await page.getByRole('textbox', { name: '••••••••' }).fill(process.env.PW || '');
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(
    page.locator('div').filter({ hasText: 'Nema prodaje' }).nth(1)
  ).toContainText('Trenutno nema aktivnih prodaja. Molimo Vas pokušajte kasnije.');
});