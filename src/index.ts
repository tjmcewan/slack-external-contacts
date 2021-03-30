import 'reflect-metadata'
import addOrganisationCommand from './apps/organisation-command'
import addContactsCommand from './apps/contacts-command'
import addRecordContactsShortcut from './apps/record-contacts-shortcut'
import { App } from '@slack/bolt'

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})

async function main() {
  addOrganisationCommand(app)
  addContactsCommand(app)
  addRecordContactsShortcut(app)
  await app.start(parseInt(process.env.PORT, 10) || 9000)
  console.log('⚡️ Bolt app is running!')
}

try {
  main()
} catch (error) {
  console.error(error)
}
