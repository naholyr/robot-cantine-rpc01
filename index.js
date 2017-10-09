#!/usr/bin/env node

'use strict'

const { status, dates, files, mailer, download, url } = require('./utils')
const conf = require('rc')('robotcantine', {})
const gm = require('gm')
const sha1 = require('sha1')

const { weekMonday, todayOrNextMonday } = dates()
const { sentDay } = status()

// Configuration hash: to detect if configuration changed between two executions
const confHash = sha1(JSON.stringify(conf))

// Reference day/week if we must check daily or weekly
const refDay = todayOrNextMonday.format('YYYYDDD')
const refWeek = weekMonday.year() * 52 + weekMonday.week()

// Already sent this week or day?
let alreadySent = false
if (!conf.includeDayMenu && status.sentWeek >= refWeek) {
  console.log('Menu already sent this week.')
  console.log('Day menu extraction disabled.')
  alreadySent = true
} else if (sentDay >= refDay) {
  console.log('Menu already sent today.')
  alreadySent = true
}
if (alreadySent) {
  if (status.confHash && confHash !== status.confHash) {
    console.log('Configuration has changed! sending anyway…')
  } else {
    process.exit(0)
  }
}

// We can proceed: generate local cached file names
const { filename, thumbname, exists } = files(conf, {weekMonday, todayOrNextMonday})
const URL = url(conf, {weekMonday})

// Final action: send the mails
const sendMail = () => {
  console.log('Sending email…')
  mailer(conf).sendMail({
    from: conf.mail.from,
    to: conf.mail.from,
    bcc: conf.mail.to,
    subject: weekMonday.format(conf.mail.subject),
    text: conf.mail.text.replace(/\{URL\}/, URL),
    attachments: [ { path: filename } ]
      .concat(conf.includeDayMenu ? [ { path: thumbname } ] : [])
  }, (err, info) => {
    if (err) {
      throw err
    }
    console.log(`Message sent: ${info.response}.`)
    status({
      sentWeek: refWeek,
      sentDay: refDay,
      confHash
    })
  })
}

// Download if needed
if (exists) {
  console.log(`Menu already saved at ${filename}.`)
} else {
  console.log(`Fetching ${url}…`)
  download(conf, URL, filename)
  console.log(`Written ${filename}.`)
}

// Extract day menu or just send week menu
if (conf.includeDayMenu) {
  console.log('Extracting today\'s menu…')
  const d = todayOrNextMonday.day()
  const g = gm(filename)
  g.size((err, { width, height }) => {
    if (err) {
      throw err
    }
    const w = width * 0.172
    const h = height * 0.70
    const x = width * 0.105 + (d - 1) * width * 0.172
    const y = height * 0.175
    g.crop(w, h, x, y).write(thumbname, err => {
      if (err) {
        throw err
      }
      console.log(`Written ${thumbname}.`)
      sendMail()
    })
  })
} else {
  console.log('Day menu extraction disabled.')
  sendMail()
}
