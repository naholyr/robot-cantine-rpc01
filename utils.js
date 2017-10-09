'use strict'

const moment = require('moment')
const { createTransport } = require('nodemailer')
const home = require('user-home')
const { join } = require('path')
const { statSync, readFileSync, writeFileSync } = require('fs')
const request = require('sync-request')
const ical = require('ical')
const { tmpdir } = require('os')
const path = require('path')
const Holidays = require('date-holidays')

moment.locale('fr')

const holidays = new Holidays('fr')

const getRPCBaseUrl = code => `http://rpc01.com/menus/menus-${code.substring(0, 2)}/menus-${code}`
const getSchoolVacationIcalUrl = zone => `http://www.education.gouv.fr/download.php?file=http://cache.media.education.gouv.fr/ics/Calendrier_Scolaire_Zone_${zone}.ics`
const SCHOOL_VACATION_SUMMER_START = 'Vacances d\'été'
const SCHOOL_VACATION_SUMMER_END = 'Rentrée scolaire des élèves'

exports.mailer = ({ mail }) => createTransport(mail.transport)

exports.dates = () => {
  const date = moment()
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
  const thumbname = todayOrNextMonday.format(conf.thumbname)
  return { filename, thumbname, exists: exists(filename) }
}

const download = exports.download = ({ userAgent }, url, filename) => {
  const headers = { 'User-Agent': userAgent }
  const res = request('GET', url, { headers })
  writeFileSync(filename, res.body)
}

const isHoliday = ({zone, userAgent}, date) =>
  // Holiday?
  holidays.isHoliday(date.toDate()) ||
  // School vacation?
  isSchoolVacation({zone, userAgent}, date)

let _schoolVacations = null
const loadSchoolVacations = ({zone, userAgent}) => {
  if (_schoolVacations) {
    return _schoolVacations
  }
  const url = getSchoolVacationIcalUrl(zone)
  const filename = path.join(tmpdir(), `vacances-scolaires-${zone}.ics`)
  if (!exists(filename)) {
    download({userAgent}, url, filename)
  }
  const cal = ical.parseICS(readFileSync(filename, 'utf8'))
  const events = Object.keys(cal).map(id => cal[id])
  // Now transform into an array of start/end:
  return events
    .map(({ type, description, start, end }) => {
      if (start && end) {
        return { description, start, end }
      } else if (start && description === SCHOOL_VACATION_SUMMER_START) {
        // look for event named SCHOOL_VACATION_SUMMER_END
        const endEvent = events.find(({ description }) => description === SCHOOL_VACATION_SUMMER_END)
        if (!endEvent) {
          throw new Error('Impossible de trouver la fin des vacances d\'été :(')
        }
        return { description, start, end: endEvent.start }
      } else {
        // other cases do not matter
        return null
      }
    })
    .filter(e => e !== null)
}

const isSchoolVacation = ({zone, userAgent}, date) => {
  const events = loadSchoolVacations({zone, userAgent})
  return events.some(({ start, end }) => date.isSameOrBefore(end) && date.isSameOrAfter(start))
}

const firstWorked = (conf, date, step, max) => {
  if (max === 0) {
    return null
  }
  if (isHoliday(conf, date)) {
    return firstWorked(conf, date.add(step, 'day'), step, max - step)
  }
  return date
}

// ex. http://rpc01.com/menus/menus-11/menus-112/201637-semaine%20du%2012%20au%2016%20septembre%202016.pdf
exports.url = ({userAgent, rpcCode, zone}, {weekMonday}) => {
  const urlStart = getRPCBaseUrl(String(rpcCode))
  const start = firstWorked({zone, userAgent}, weekMonday, +1, 4)
  if (!start) {
    return null
  }
  const end = firstWorked({zone, userAgent}, moment(weekMonday).add(4, 'day'), -1, -4)
  let parts = [
    start.format(`[${urlStart}/]YYYYw[-semaine%20du%20]D`),
    '', // monday's month
    '', // monday's year
    'au',
    end.format('D[%20]MMMM[%20]YYYY[.pdf]')
  ]
  if (start.year() !== end.year()) {
    parts[1] = start.format('MMMM')
    parts[2] = start.format('YYYY')
  } else if (start.month() !== end.month()) {
    parts[1] = start.format('MMMM')
  }
  return parts.filter(s => s !== '').join('%20')
}
