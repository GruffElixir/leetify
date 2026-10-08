import {expect} from '@playwright/test';
export async function components(page) {const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await expect(page.locator('#leetify-workspace')).toBeVisible();return errors;}
export async function replaceCode(page,code) {await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(code);}
