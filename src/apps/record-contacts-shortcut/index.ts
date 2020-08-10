import { In } from 'typeorm'
import { App } from '@slack/bolt'
import {
  formattedOrganisationNameWithAbbrev,
  toCurrency,
  valueOrFallback,
  nameForContact,
} from '../../helpers/format'
import { textSearchSQL } from '../../helpers/search'
import { selectedValuesFromSubmission } from '../../helpers/submission'
import { optionForContact, optionForEntity } from '../../helpers/blocks'
import { User } from '../../entity/User'
import { Message } from '../../entity/Message'
import { Contact } from '../../entity/Contact'
import { Organisation } from '../../entity/Organisation'

export default function (app: App, repositories) {
  const {
    contactRepository,
    organisationRepository,
    messageRepository,
    programRepository,
    userRepository,
  } = repositories

  app.action('contact_select', async ({ action, body, context, ack }) => {
    await ack()
    let selectedValues = action['selected_options'].map((o) => o.value)
    let message = await messageRepository.findOne(body['view'].private_metadata)
    let contacts = selectedValues.length
      ? await contactRepository.find({ id: In(selectedValues || []) })
      : []
    message.contacts = contacts
    await messageRepository.save(message)
  })

  app.options('contact_select', async ({ options, ack }) => {
    const matchingContacts = await contactRepository
      .createQueryBuilder('contact')
      .leftJoinAndSelect('contact.organisations', 'organisation')
      .where(textSearchSQL, { value: options.value })
      .getMany()
    await ack({ options: matchingContacts.map(optionForContact) })
  })

  app.action('add_contact', async ({ action, body, context, ack, client }) => {
    await ack()
    const organisations = await organisationRepository.find({
      order: { name: 'ASC' },
    })
    await client.views.push({
      trigger_id: body['trigger_id'],
      token: context.botToken,
      view: {
        type: 'modal',
        callback_id: 'create_contact',
        title: { type: 'plain_text', text: 'Create external contact' },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: body['view']['private_metadata'],
        submit: {
          type: 'plain_text',
          text: 'Save',
        },
        blocks: [
          {
            type: 'input',
            block_id: 'contact-first-name',
            label: {
              type: 'plain_text',
              text: 'First Name',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'first-name-value',
            },
          },
          {
            type: 'input',
            block_id: 'contact-last-name',
            label: {
              type: 'plain_text',
              text: 'Last Name',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'last-name-value',
            },
          },
          {
            type: 'input',
            block_id: 'contact-email',
            label: {
              type: 'plain_text',
              text: 'Email',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'email-value',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'contact-phone',
            label: {
              type: 'plain_text',
              text: 'Phone',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'phone-value',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'contact-org',
            label: {
              type: 'plain_text',
              text: 'Organisations',
            },
            element: {
              action_id: 'organisation_select',
              type: 'multi_static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Search organisation',
                emoji: true,
              },
              options: organisations.map(optionForEntity),
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'contact-role',
            label: {
              type: 'plain_text',
              text: 'Role',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'role-value',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'contact-point',
            label: {
              type: 'plain_text',
              text: 'Point Person',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'point-value',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'contact-notes',
            label: {
              type: 'plain_text',
              text: 'Additional Notes',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'notes-value',
              multiline: true,
            },
            optional: true,
          },
        ],
      },
    })
  })

  app.action(
    'add_organisation',
    async ({ action, body, context, ack, client }) => {
      await ack()
      const programs = await programRepository.find({
        order: { name: 'ASC' },
      })
      await client.views.push({
        token: context.botToken,
        trigger_id: body['trigger_id'],
        view: {
          type: 'modal',
          callback_id: 'create_organisation',
          title: { type: 'plain_text', text: 'Create organisation' },
          close: {
            type: 'plain_text',
            text: 'Cancel',
          },
          private_metadata: body['view']['private_metadata'],
          submit: {
            type: 'plain_text',
            text: 'Save',
          },
          blocks: [
            {
              type: 'input',
              block_id: 'organisation-name',
              label: {
                type: 'plain_text',
                text: 'Name',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'name-value',
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-abbreviation',
              label: {
                type: 'plain_text',
                text: 'Abbreviated name e.g. TAI, TWS etc.',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'abbreviation-value',
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-previous_grants',
              label: {
                type: 'plain_text',
                text: 'Grants in previous financial year in $',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'previous_grants-value',
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-grants_approved',
              label: {
                type: 'plain_text',
                text: 'Approved grants in current year in $',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'grants_approved-value',
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-grants_distributed',
              label: {
                type: 'plain_text',
                text: 'Grants distributed to date in $',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'grants_distributed-value',
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-grants_in_process',
              label: {
                type: 'plain_text',
                text: 'Grants in process',
              },
              element: {
                type: 'static_select',
                action_id: 'grants_in_process-value',
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'no',
                    },
                    value: 'false',
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'yes',
                    },
                    value: 'true',
                  },
                ],
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-future_grants_in_consideration',
              label: {
                type: 'plain_text',
                text: 'Future grants in consideration',
              },
              element: {
                type: 'static_select',
                action_id: 'future_grants_in_consideration-value',
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'no',
                    },
                    value: 'no',
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'yes',
                    },
                    value: 'yes',
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'possible',
                    },
                    value: 'possible',
                  },
                ],
              },
            },
            {
              type: 'input',
              optional: true,
              block_id: 'organisation-programs',
              label: {
                type: 'plain_text',
                text: 'Program areas',
              },
              element: {
                type: 'multi_static_select',
                action_id: 'programs-value',
                options: programs.map(optionForEntity),
              },
            },
            {
              type: 'input',
              block_id: 'organisation-notes',
              label: {
                type: 'plain_text',
                text: 'Additional Notes',
              },
              element: {
                type: 'plain_text_input',
                action_id: 'notes-value',
                multiline: true,
              },
              optional: true,
            },
          ],
        },
      })
    },
  )

  app.shortcut(
    'record_contact',
    async ({ shortcut, ack, respond, context, client }) => {
      await ack()

      const messageData = shortcut['message']
      let user = await userRepository.findOne({
        slackID: messageData.user,
      })
      if (!user) {
        user = new User()
        user.slackID = messageData.user
        user.team_id = messageData.team
        await userRepository.save(user)
      }

      const channelID = shortcut['channel'].id
      let message = await messageRepository.findOne({
        where: {
          channelID,
          ts: messageData.ts,
          user: user,
        },
        relations: ['contacts', 'contacts.organisations'],
      })
      if (!message) {
        message = new Message()
        message.channelID = channelID
        message.ts = messageData.ts
        message.user = user
        message.text = messageData.text
        message.contacts = []
        await messageRepository.save(message)
      }

      await client.views.open({
        token: context.botToken,
        trigger_id: shortcut.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'update_contact',
          title: { type: 'plain_text', text: 'Record external contact' },
          close: {
            type: 'plain_text',
            text: 'Cancel',
          },
          private_metadata: `${message.id}`,
          submit: {
            type: 'plain_text',
            text: 'Save',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'External contacts mentioned in this post:',
              },
              accessory: {
                action_id: 'contact_select',
                type: 'multi_external_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Search contacts',
                  emoji: true,
                },
                initial_options: message.contacts.map(optionForContact),
                min_query_length: 3,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  action_id: 'add_organisation',
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Add new organisation',
                    emoji: true,
                  },
                  value: 'add_organisation',
                },
                {
                  action_id: 'add_contact',
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Add new contact',
                    emoji: true,
                  },
                  value: 'add_contact',
                },
              ],
            },
          ],
        },
      })
    },
  )

  app.view('create_contact', async ({ ack, body, view, context }) => {
    await ack()
    const contact = new Contact()
    const values = view['state']['values']
    contact.firstName =
      values['contact-first-name']['first-name-value']['value']
    contact.lastName = values['contact-last-name']['last-name-value']['value']
    contact.email = values['contact-email']['email-value']['value']
    contact.phone = values['contact-phone']['phone-value']['value']
    contact.role = values['contact-role']['role-value']['value']
    contact.point = values['contact-point']['point-value']['value'] === 'yes'
    contact.notes = values['contact-notes']['notes-value']['value']
    const selectedValues = selectedValuesFromSubmission(
      values['contact-org']['organisation_select'],
    )
    contact.organisations = selectedValues.length
      ? await organisationRepository.find({ id: In(selectedValues) })
      : []
    await contactRepository.save(contact)
  })

  app.view('create_organisation', async ({ ack, body, view, context }) => {
    await ack()
    const organisation = new Organisation()
    const values = view['state']['values']
    const textFields = [
      'name',
      'abbreviation',
      'previous_grants',
      'grants_approved',
      'grants_distributed',
      'notes',
    ]
    textFields.forEach((field) => {
      organisation[field] =
        values[`organisation-${field}`][`${field}-value`]['value']
    })
    const selectFields = ['grants_in_process', 'future_grants_in_consideration']
    selectFields.forEach((field) => {
      const selected_option =
        values[`organisation-${field}`][`${field}-value`]['selected_option']
      organisation[field] = selected_option ? selected_option.value : null
    })
    const selectedPrograms = selectedValuesFromSubmission(
      values['organisation-programs']['programs-value'],
    )
    organisation.programs = selectedPrograms.length
      ? await programRepository.find({ id: In(selectedPrograms) })
      : []
    await organisationRepository.save(organisation)
  })

  app.view('update_contact', async ({ ack }) => {
    // Fake this response as data is actually saved when records are selected
    await ack()
  })
}
