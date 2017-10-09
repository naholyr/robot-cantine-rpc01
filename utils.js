'use strict'

const moment = require('moment')
const { createTransport } = require('nodemailer')
const home = require('user-home')
const { join } = require('path')
const { createWriteStream, statSync, readFileSync, writeFileSync } = require('fs')
const get = require('request')

exports.mailer = ({ mail }) => createTransport(mail.transport)

exports.dates = () => {
  const date = moment().locale('fr')
  const weekMonday = date.day() === 6 // saturday
    ? moment(date).day(8) // next monday
    : moment(date).day(1) // last monday
  const todayOrNextMonday = (date.day() === 6 || date.day() === 0) // week-end
    ? moment(weekMonday)
    : moment(date)
  return { todayOrNextMonday, weekMonday }
}

const statusFile = join(home, '.robotcantine.status.json')
exports.status = (content) => {
  try {
    if (content) {
      writeFileSync(statusFile, JSON.stringify(content) + '\n')
      return content
    } else {
      return JSON.parse(readFileSync(statusFile))
    }
  } catch (e) {
    return {}
  }
}

const exists = filename => {
  try {
    return statSync(filename).size > 10000
  } catch (e) {
    return false
  }
}

exports.files = (conf, {weekMonday, todayOrNextMonday}) => {
  const filename = weekMonday.format(conf.filename)
  console.log(filename)
  const thumbname = todayOrNextMonday.format(conf.thumbname)
  return { filename, thumbname, exists: exists(filename) }
}

exports.download = ({ userAgent }, url, filename, next) => {
  get({
    url,
    headers: {
      'User-Agent': userAgent
    }
  }).pipe(createWriteStream(filename)).on('close', () => {
    next()
  })
}

// ex. http://rpc01.com/menus/menus-11/menus-112/201637-semaine%20du%2012%20au%2016%20septembre%202016.pdf
exports.url = ({rpcCode}, {weekMonday}) => {
  const urlStart = `http://rpc01.com/menus/menus-${String(rpcCode).substring(0, 2)}/menus-${rpcCode}`
  return (
    weekMonday.format(`[${urlStart}/]YYYYw[-semaine%20du%20]D[%20au%20]`) +
    (weekMonday.date() + 4) +
    weekMonday.format('[%20]MMMM[%20]YYYY[.pdf]')
  )
}
