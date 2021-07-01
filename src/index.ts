/**
*   This script is to bypass SSO
*/
import chromium from 'chrome-aws-lambda';
import { Browser, Page } from 'puppeteer-core';
import log4js, { Logger } from 'log4js';
import { Authenticator } from 'otplib/core';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';

let logger: Logger;

const initialLogger = async () => {
    /**
    *   This function is to initial logger
    */
    try {
        logger = log4js.getLogger();
        logger.level = 'info';
        return logger;
    } catch (error) {
        console.error(error);
        throw new Error('Error while initial logger.');
    }
};

const initialBrowser = async () => {
    /**
    *   This function is to initial broswer
    */
    try {
        const browser = await chromium.puppeteer.launch({
            args: [
                ...chromium.args,
                '--lang=en-US',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            // headless: true,
            headless: false,
            ignoreHTTPSErrors: true,
        });
        return browser;
    } catch (error) {
        logger.error(error);
        throw new Error('Error while initial browser.');
    }
};

const initialPage = async (
    _browser: Browser,
    _timesheetUrl: string,
) => {
    /**
    * This function is to initial page
    */
    try {
        const page = (await _browser.pages())[0] || _browser.newPage();
        await page.goto(_timesheetUrl);
        logger.info(`Navigate to ${_timesheetUrl}.`);
        return page;
    } catch (error) {
        logger.error(error);
        throw new Error('Error while initial page.');
    }
};

const fillInputFields = async (
    _page: Page,
    _startDate: string,
    _endDate: string,
    _key: string,
) => {
    await _page.waitForSelector('#startDate', { timeout: 60000 });
    await _page.type('#startDate', _startDate);
    logger.info(`Type startDate as ${_startDate}`);
    await _page.waitForSelector('#endDate', { timeout: 60000 });
    await _page.type('#endDate', _endDate);
    logger.info(`Type endDate as ${_endDate}`);
    await _page.waitForSelector('#key', { timeout: 60000 });
    await _page.type('#key', _key);
    logger.info(`Type key as ${_key}`);
};

const getMFACode = async (
    _mfaSecret: string,
) => {
    /**
    *   This function is to get mfa code
    */
    try {
        const authenticator = new Authenticator({
            createDigest,
            createRandomBytes,
            keyDecoder,
            keyEncoder,
        });
        const token = authenticator.generate(_mfaSecret);
        logger.info(`Get mfa code as ${token}`);
        return token;
    } catch (error) {
        logger.error(error);
        throw new Error('Error while get mfa code.');
    }
};

const processLoginAction = async (
    _browser: Browser,
    _page: Page,
    _adUsername: string,
    _adPassword: string,
    _mfaCode: string,
) => {
    /**
    *   This function is to process login action
    */
    try {
        await _page.waitForSelector('#SignIn', { timeout: 60000 });
        await _page.click('#SignIn');
        const [, loginPage] = await _browser.pages();
        await loginPage.waitForSelector('#i0116', { timeout: 60000 });
        await loginPage.type('#i0116', _adUsername);
        await loginPage.waitForSelector('#idSIButton9', { timeout: 60000 });
        await loginPage.click('#idSIButton9');
        await loginPage.waitForTimeout(1500);
        await loginPage.waitForSelector('#i0118', { timeout: 60000 });
        await loginPage.type('#i0118', _adPassword);
        await loginPage.waitForSelector('#idSIButton9', { timeout: 60000 });
        await loginPage.click('#idSIButton9');
        await loginPage.waitForTimeout(1500);
        await loginPage.waitForSelector('#idTxtBx_SAOTCC_OTC', { timeout: 60000 });
        await loginPage.type('#idTxtBx_SAOTCC_OTC', _mfaCode);
        await loginPage.waitForSelector('#idSubmit_SAOTCC_Continue', { timeout: 60000 });
        await loginPage.click('#idSubmit_SAOTCC_Continue');
        await loginPage.waitForTimeout(1500);
        await loginPage.waitForSelector('#idSIButton9', { timeout: 60000 });
        await loginPage.click('#idSIButton9');
        logger.info('Login succeed');
    } catch (error) {
        logger.error(error);
        throw new Error('Error while process login action');
    }
};

// eslint-disable-next-line import/prefer-default-export
export const main = async () => {
    /**
    *   This is main function
    */
    try {
        initialLogger();
        const {
            ADUSERNAME: adUsername,
            ADPASSWORD: adPassword,
            TIMESHEET_URL: timesheetUrl,
            MFASecret: mfaSecret,
        } = process.env;
        const startDate = '20210601';
        const endDate = '20210630';
        const key = 'test';
        const browser = await initialBrowser();
        if (!adUsername || !adPassword || !timesheetUrl || !mfaSecret) {
            throw new Error('Error while getting env variables.');
        }
        const page = await initialPage(browser, timesheetUrl);
        await fillInputFields(
            page,
            startDate,
            endDate,
            key,
        );
        const mfaCode = await getMFACode(mfaSecret);
        await processLoginAction(
            browser,
            page,
            adUsername,
            adPassword,
            mfaCode,
        );
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};
