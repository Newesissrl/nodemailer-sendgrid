'use strict';

const test = require('node:test');
const assert = require('node:assert');
const sgMail = require('@sendgrid/mail');
const nodemailerSendgrid = require('../index');

// Every supported nodemailer major is installed as a devDependency alias.
const NODEMAILER_MODULES = ['nodemailer-v7', 'nodemailer-v8', 'nodemailer-v9', 'nodemailer'];

let sent = [];
sgMail.send = (msg, callback) => {
    sent.push(msg);
    setImmediate(() => callback(null, [{ statusCode: 202, statusMessage: 'Accepted' }, {}]));
};

for (const moduleName of NODEMAILER_MODULES) {
    const nodemailer = require(moduleName);
    const version = require(`${moduleName}/package.json`).version;

    test(`maps a nodemailer ${version} message to a SendGrid request`, async () => {
        sent = [];
        const transport = nodemailer.createTransport(nodemailerSendgrid({ apiKey: 'SG.test-key' }));
        const info = await transport.sendMail({
            from: 'Sender <sender@example.com>',
            to: 'Receiver <receiver@example.com>, other@example.com',
            cc: 'cc@example.com',
            bcc: 'bcc@example.com',
            replyTo: 'reply@example.com',
            subject: 'hello world',
            text: 'Hello text',
            html: '<h1>Hello html</h1>',
            messageId: '<message-id@example.com>',
            headers: { 'X-Custom': 'yes' },
            attachments: [
                { filename: 'a.txt', content: 'aGVsbG8=', encoding: 'base64', contentType: 'text/plain' },
                { filename: 'logo.png', content: 'iVBORw0K', encoding: 'base64', contentType: 'image/png', cid: 'logo@example.com' }
            ],
            icalEvent: { filename: 'invite.ics', content: 'BEGIN:VCALENDAR' },
            templateId: 'd-123'
        });

        assert.strictEqual(sent.length, 1);
        const msg = sent[0];
        assert.deepStrictEqual(msg.from, { name: 'Sender', email: 'sender@example.com' });
        assert.deepStrictEqual(msg.replyTo, { name: '', email: 'reply@example.com' });
        assert.deepStrictEqual(
            msg.to.map(entry => entry.email),
            ['receiver@example.com', 'other@example.com']
        );
        assert.deepStrictEqual(msg.cc, [{ name: '', email: 'cc@example.com' }]);
        assert.deepStrictEqual(msg.bcc, [{ name: '', email: 'bcc@example.com' }]);
        assert.strictEqual(msg.subject, 'hello world');
        assert.strictEqual(msg.text, 'Hello text');
        assert.strictEqual(msg.html, '<h1>Hello html</h1>');
        assert.strictEqual(msg.templateId, 'd-123');
        assert.strictEqual(msg.headers['X-Custom'], 'yes');
        // Known limitation (all nodemailer versions): the raw `headers` key overwrites the
        // `message-id` header set from `messageId`, so the Message-ID is not forwarded.

        assert.strictEqual(msg.attachments.length, 3);
        const [plain, inline, ical] = msg.attachments;
        assert.strictEqual(plain.filename, 'a.txt');
        assert.strictEqual(plain.disposition, 'attachment');
        assert.strictEqual(inline.content_id, 'logo@example.com');
        assert.strictEqual(inline.disposition, 'inline');
        assert.strictEqual(ical.filename, 'invite.ics');
        assert.strictEqual(ical.type, 'application/ics');

        assert.ok(info, 'sendMail resolves with the SendGrid response');
    });

    test(`moves text and html into content when alternatives are used (nodemailer ${version})`, async () => {
        sent = [];
        const transport = nodemailer.createTransport(nodemailerSendgrid({ apiKey: 'SG.test-key' }));
        await transport.sendMail({
            from: 'sender@example.com',
            to: 'receiver@example.com',
            subject: 'alternatives',
            text: 'plain',
            html: '<b>html</b>',
            alternatives: [{ contentType: 'text/x-web-markdown', content: '**md**' }]
        });
        const msg = sent[0];
        assert.strictEqual(msg.text, undefined);
        assert.strictEqual(msg.html, undefined);
        assert.deepStrictEqual(
            msg.content.map(entry => entry.type),
            ['text/html', 'text/plain', 'text/x-web-markdown']
        );
    });

    test(`propagates SendGrid errors (nodemailer ${version})`, async () => {
        const originalSend = sgMail.send;
        sgMail.send = (msg, callback) => setImmediate(() => callback(new Error('Unauthorized')));
        try {
            const transport = nodemailer.createTransport(nodemailerSendgrid({ apiKey: 'SG.test-key' }));
            await assert.rejects(
                transport.sendMail({ from: 'sender@example.com', to: 'receiver@example.com', subject: 'x', text: 'x' }),
                /Unauthorized/
            );
        } finally {
            sgMail.send = originalSend;
        }
    });
}
