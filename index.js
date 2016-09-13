'use strict'

const moment = require('moment')
const get = require('request')
const { createWriteStream, statSync, readFileSync, writeFileSync } = require('fs')
const conf = require('rc')('robotcantine', {})
const { createTransport } = require('nodemailer')
const gm = require('gm')
const home = require('user-home')
const { join } = require('path')


const mailer = createTransport(conf.mail.transport)

const date = moment().locale('fr')
const weekMonday = date.day() === 6 // saturday
  ? moment(date).day(8)
  : moment(date).day(1)
const todayOrNextMonday = (date.day() === 6 || date.day() === 0) // week-end
  ? moment(weekMonday)
  : moment(date)

// ex. http://rpc01.com/menus/menus-11/menus-112/201637-semaine%20du%2012%20au%2016%20septembre%202016.pdf
const url =
  weekMonday.format('[http://rpc01.com/menus/menus-11/menus-112/]YYYYw[-semaine%20du%20]D[%20au%20]') +
  (weekMonday.date() + 4) +
  weekMonday.format('[%20]MMMM[%20]YYYY[.pdf]')

const statusFile = join(home, '.robotcantine.status.json')
const status = (() => {
  try {
    return JSON.parse(readFileSync(statusFile))
  } catch (e) {
    return {}
  }
})()

if (!conf.includeDayMenu && status.sentWeek >= weekMonday.week()) {
  console.log('Menu already sent this week.')
  console.log('Day menu extraction disabled.')
  process.exit(0)
}

if (status.sentDay >= todayOrNextMonday.format('YYYYDDD')) {
  console.log('Menu already sent today.')
  process.exit(0)
}

const filename = weekMonday.format(conf.filename)
const thumbname = todayOrNextMonday.format(conf.thumbname)
const exists = (() => {
  try {
    return statSync(filename).size > 10000
  } catch (e) {
    return false
  }
})()

if (exists) {
  console.log(`Menu already saved at ${filename}.`)
  extractTodayMenu()
} else {
  downloadAndSave()
}

function downloadAndSave () {
  console.log(`Fetching ${url}…`)
  get({
    url,
    headers: {
      'User-Agent': conf.userAgent
    }
  }).pipe(createWriteStream(filename)).on('close', () => {
    console.log(`Written ${filename}.`)
    extractTodayMenu()
  })
}

function extractTodayMenu () {
  if (!conf.includeDayMenu) {
    console.log('Day menu extraction disabled.')
    sendMail()
    return
  }

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
}

function sendMail () {
  console.log('Sending email…')
  mailer.sendMail({
    from: conf.mail.from,
    to: conf.mail.to,
    subject: weekMonday.format(conf.mail.subject),
    text: conf.mail.text.replace(/\{URL\}/, url),
    attachments: [ { path: filename } ]
      .concat(conf.includeDayMenu ? [ { path: thumbname } ] : [])
  }, (err, info) => {
    if (err) {
      throw err
    }
    console.log(`Message sent: ${info.response}.`)
    writeFileSync(statusFile, JSON.stringify({
      sentWeek: weekMonday.week(),
      sentDay: todayOrNextMonday.format('YYYYDDD')
    }) + '\n')
  })
}
