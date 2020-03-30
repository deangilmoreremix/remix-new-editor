export default [
  {
    key: 'custom',
    value: '--Custom--',
    token: {
      open: '',
      close: '',
    },
    format: (variable) => `${variable}_token`,
  },
  {
    key: '1shoppingcart',
    value: '1ShoppingCart',
    token: {
      open: '%$',
      close: '$%',
    },
    lookup: {
      FIRSTNAME: 'firstname',
    },
  },
  {
    key: 'activecampaign',
    value: 'Active Campaign',
    token: {
      open: '%',
      close: '%',
    },
    lookup: {
      FIRSTNAME: 'FIRSTNAME',
      LASTNAME: 'LASTNAME',
      EMAIL: 'EMAIL',
      NAME: 'FULLNAME',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'acton',
    value: 'Act-On',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'E-mail Address',
    },
  },
  {
    key: 'adestra',
    value: 'Adestra',
    token: {
      open: '$',
      close: '$',
    },
    lookup: {
      FIRSTNAME: "data('firstname')",
      EMAIL: "data('email')",
    },
  },
  {
    key: 'adobecampaign',
    value: 'Adobe Campaign',
    token: {
      open: '<%=',
      close: '%>',
    },
    lookup: {
      FIRSTNAME: 'recipient.FirstName',
      LASTNAME: 'recipient.LastName',
      EMAIL: 'recipient.Email',
    },
  },
  {
    key: 'agilecrm',
    value: 'Agile CRM',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
    },
  },
  {
    key: 'autopilothq',
    value: 'AutoPilotHQ',
    token: {
      open: '--',
      close: '--',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'Email',
    },
  },
  {
    key: 'aweber',
    value: 'Aweber',
    token: {
      open: '{!',
      close: '}',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      NAME: 'name',
    },
  },
  {
    key: 'constantcontact',
    value: 'Constant Contact',
    token: {
      open: '',
      close: '',
    },
    lookup: {
      FIRSTNAME: '$SUBSCRIBER.FIRSTNAME',
      LASTNAME: '$SUBSCRIBER.LASTNAME',
      EMAIL: '$SUBSCRIBER.EMAIL',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'convertkit',
    value: 'ConvertKit',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'subscriber.first_name',
      LASTNAME: 'subscriber.last_name',
      EMAIL: 'subscriber.email_address',
    },
  },
  {
    key: 'cordial',
    value: 'Cordial',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: '$contact.firstName',
      LASTNAME: '$contact.lastName',
      EMAIL: '$contact.channels.email.address',
    },
  },
  {
    key: 'customerio',
    value: 'Customer.io',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'customer.first_name',
      LASTNAME: 'customer.last_name',
      EMAIL: 'customer.email',
      NAME: 'customer.full_name',
    },
  },
  {
    key: 'databank',
    value: 'Databank',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'fname',
    },
  },
  {
    key: 'delivra',
    value: 'Delivra',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'FirstName_',
      LASTNAME: 'LastName_',
      NAME: 'FullName_',
    },
  },
  {
    key: 'dialoginsight',
    value: 'Dialog Insight',
    token: {
      open: '[[=',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'Contact.f_FirstName;',
      EMAIL: 'Contact.f_EMail;',
      GENDER: 'Contact.f_sex;',
    },
  },
  {
    key: 'dotmailer',
    value: 'DotMailer',
    token: {
      open: '@',
      close: '@',
    },
    lookup: {
      FIRSTNAME: 'FIRSTNAME',
      LASTNAME: 'LASTNAME',
      EMAIL: 'EMAIL',
      NAME: 'FULLNAME',
      GENDER: 'GENDER',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'easysendy',
    value: 'EasySendy',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'eflyermaker',
    value: 'eflyermaker',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'dyn.firstname',
      LASTNAME: 'dyn.lastname',
      EMAIL: 'dyn.email',
    },
  },
  {
    key: 'elasticemail',
    value: 'Elastic Email',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
    },
  },
  {
    key: 'eloqua',
    value: 'Eloqua',
    token: {
      open: "<span class='eloquaemail'>",
      close: '</span>',
    },
    lookup: {
      FIRSTNAME: 'FirstName',
      LASTNAME: 'LastName',
      EMAIL: 'EmailAddress',
      NAME: 'Name',
    },
  },
  {
    key: 'emarsys',
    value: 'Emarsys',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'contact.1',
      LASTNAME: 'contact.2',
      EMAIL: 'contact.3',
      GENDER: 'contact.5',
    },
  },
  {
    key: 'emma',
    value: 'Emma',
    token: {
      open: '[%',
      close: '%]',
    },
    lookup: {
      FIRSTNAME: 'member:first_name',
      LASTNAME: 'member:last_name',
      EMAIL: 'member:email',
      GENDER: 'member:gender',
    },
  },
  {
    key: 'esputnik',
    value: 'eSputnik',
    token: {
      open: '%',
      close: '%',
    },
    lookup: {
      FIRSTNAME: 'FIRSTNAME|',
      LASTNAME: 'LASTNAME|',
      EMAIL: 'EMAIL|',
      GENDER: 'PERSONAL.GENDER|',
    },
    format: (variable) => `${variable.toUpperCase()}|`,
  },
  {
    key: 'exacttarget',
    value: 'ExactTarget',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
    },
  },
  {
    key: 'experian',
    value: 'Experian',
    token: {
      open: '##',
      close: '##',
    },
    lookup: {
      FIRSTNAME: 'Field_username',
    },
  },
  {
    key: 'expertsender',
    value: 'ExpertSender',
    token: {
      open: '*[',
      close: ']*',
    },
    lookup: {
      FIRSTNAME: 'subscriber_firstname',
      LASTNAME: 'subscriber_lastname',
      EMAIL: 'subscriber_email',
    },
  },
  {
    key: 'flexie',
    value: 'Flexie',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
    },
  },
  {
    key: 'getresponse',
    value: 'GetResponse',
    token: {
      open: '[[',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      NAME: 'name',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'hubspot',
    value: 'HubSpot',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'contact.firstname',
      LASTNAME: 'contact.lastname',
      EMAIL: 'contact.email',
      GENDER: 'contact.gender',
    },
  },
  {
    key: 'icommkt',
    value: 'iCommkt',
    token: {
      open: '<*',
      close: '*>',
    },
    lookup: {
      FIRSTNAME: 'nombre',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'icontact',
    value: 'iContact',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'fname',
      LASTNAME: 'lname',
      EMAIL: 'email',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'informz',
    value: 'Informz',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'Email',
    },
  },
  {
    key: 'infusionsoft',
    value: 'InfusionSoft',
    token: {
      open: '~',
      close: '~',
    },
    lookup: {
      FIRSTNAME: 'Contact.FirstName',
      LASTNAME: 'Contact.LastName',
      EMAIL: 'Contact.Email',
    },
  },
  {
    key: 'instiller',
    value: 'Instiller',
    token: {
      open: '{?',
      close: '?}',
    },
    lookup: {
      FIRSTNAME: '$contacts_first_name',
      LASTNAME: '$contacts_last_name',
      EMAIL: '$contacts_email',
    },
  },
  {
    key: 'intercom',
    value: 'Intercom',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
      NAME: 'name',
    },
  },
  {
    key: 'interspire',
    value: 'Interspire',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'emailaddress',
    },
  },
  {
    key: 'iterable',
    value: 'Iterable',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'firstName',
      LASTNAME: 'lastName',
      EMAIL: 'email',
      GENDER: 'gender',
    },
  },
  {
    key: 'jangomail',
    value: 'JangoMail',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'FirstName',
      LASTNAME: 'LastName',
      EMAIL: 'EmailAddress',
    },
  },
  {
    key: 'klaviyo',
    value: 'Klaviyo',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
    },
  },
  {
    key: 'leanplum',
    value: 'Leanplum',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: '\'first_name\' value',
      LASTNAME: '\'last_name\' value',
      EMAIL: '\'email\' value',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'listrak',
    value: 'Listrak',
    token: {
      open: '<<',
      close: '>>',
    },
    lookup: {
      FIRSTNAME: 'Customer Information\\First Name',
      LASTNAME: 'Customer Information\\Last Name',
      EMAIL: 'Customer Information\\Email',
      GENDER: 'Customer Information\\Gender',
    },
  },
  {
    key: 'luminate',
    value: 'Luminate',
    token: {
      open: '[[',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'S1.first_name',
      LASTNAME: 'S1.last_name',
      EMAIL: 'S1.email',
    },
  },
  {
    key: 'lyris',
    value: 'Lyris',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      EMAIL: 'emailaddr',
      NAME: 'fullname',
    },
  },
  {
    key: 'madmimi',
    value: 'Mad Mimi',
    token: {
      open: '(',
      close: ')',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
    },
  },
  {
    key: 'mail2easy',
    value: 'Mail2Easy',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'cmp2|1',
    },
  },
  {
    key: 'mailcamp',
    value: 'MailCamp',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'Voornaam',
      EMAIL: 'email',
    },
  },
  {
    key: 'mailchimp',
    value: 'MailChimp',
    token: {
      open: '*|',
      close: '|*',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
  },
  {
    key: 'mailerlite',
    value: 'MailerLite',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: '$name',
      EMAIL: '$email',
    },
  },
  {
    key: 'mailganer',
    value: 'MailGaner',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'name',
      LASTNAME: 'lastname',
      EMAIL: 'email',
    },
  },
  {
    key: 'mailigen',
    value: 'Mailigen',
    token: {
      open: '#[',
      close: ']#',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
  },
  {
    key: 'mailjet',
    value: 'MailJet',
    token: {
      open: '[[',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      EMAIL: 'email',
    },
  },
  {
    key: 'mailplus',
    value: 'MailPlus',
    token: {
      open: '',
      close: '',
    },
    lookup: {
      FIRSTNAME: 'vNaam',
    },
  },
  {
    key: 'mailpoet',
    value: 'MailPoet',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'user:firstname',
      LASTNAME: 'user:lastname',
      EMAIL: 'user:email',
      NAME: 'user:firstname | user:lastname',
    },
  },
  {
    key: 'mailrelay',
    value: 'MailRelay',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'subscriber.first_name',
      LASTNAME: 'subscriber.last_name',
      EMAIL: 'subscriber.email',
      NAME: 'subscriber.name',
    },
  },
  {
    key: 'mailshake',
    value: 'MailShake',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first',
      LASTNAME: 'last',
      EMAIL: 'email',
      NAME: 'name',
    },
  },
  {
    key: 'mailup',
    value: 'MailUp',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      GENDER: 'gender',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'mailwizz',
    value: 'MailWizz',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'mailzingo',
    value: 'Mailzingo',
    token: {
      open: '[[',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      NAME: 'name',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'marketo',
    value: 'Marketo',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'lead.Email Address',
    },
  },
  {
    key: 'mindbody',
    value: 'MindBody',
    token: {
      open: '<',
      close: '>',
    },
    lookup: {
      FIRSTNAME: 'CLIENTFIRSTNAME',
      LASTNAME: 'CLIENTLASTNAME',
      NAME: 'CLIENTNAME',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'moosend',
    value: 'MooSend',
    token: {
      open: '#',
      close: '#',
    },
    lookup: {
      FIRSTNAME: 'recipient:name',
      EMAIL: 'recipient:email',
    },
  },
  {
    key: 'newzapp',
    value: 'NewZapp',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'emailaddress',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'ongage',
    value: 'Ongage',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
      GENDER: 'gender',
    },
  },
  {
    key: 'ontraport',
    value: 'ONTRAPORT',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'Email',
    },
  },
  {
    key: 'pardot',
    value: 'Pardot',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'pipelinedeals',
    value: 'PipelineDeals',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first name',
      LASTNAME: 'last name',
      EMAIL: 'email',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'postup',
    value: 'PostUp',
    token: {
      open: '[-',
      close: '-]',
    },
    lookup: {
      FIRSTNAME: 'FIRSTNAME',
      EMAIL: 'EMAIL',
      NAME: 'NAME',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'pure360',
    value: 'Pure360',
    token: {
      open: '{~',
      close: '~}',
    },
    lookup: {
      FIRSTNAME: 'First_Name',
      EMAIL: 'email',
      GENDER: 'Gender',
    },
  },
  {
    key: 'quickmail',
    value: 'Quickmail',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'prospect.first_name',
      LASTNAME: 'prospect.last_name',
      EMAIL: 'prospect.email',
    },
  },
  {
    key: 'rdstation',
    value: 'RD Station',
    token: {
      open: '|*',
      close: '|*',
    },
    lookup: {
      FIRSTNAME: 'PRIMEIRO_NOME',
      EMAIL: 'EMAIL',
      NAME: 'NOME',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'remarkety',
    value: 'Remarkety',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: '$shopper.firstName',
      LASTNAME: '$shopper.lastName',
      EMAIL: '$shopper.email',
    },
  },
  {
    key: 'responsys',
    value: 'ResponSys (Oracle Marketing Cloud)',
    token: {
      open: '${',
      close: '}',
    },
    lookup: {
      FIRSTNAME: 'FIRSTNAME',
      LASTNAME: 'LASTNAME',
      EMAIL: 'EMAIL_ADDRESS',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'retentionscience',
    value: 'Retention Science',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'fname',
      LASTNAME: 'lname',
      EMAIL: 'email',
      NAME: 'full_name',
    },
  },
  {
    key: 'robly',
    value: 'Robly',
    token: {
      open: '--',
      close: '--',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'sailthru',
    value: 'Sailthru',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: 'name',
      EMAIL: 'email',
      NAME: 'name',
      GENDER: 'profile.vars.gender',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'salesforce',
    value: 'SalesForce Marketing Cloud',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
    },
  },
  {
    key: 'salesloft',
    value: 'SalesLoft',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'first_name',
      LASTNAME: 'last_name',
      EMAIL: 'email',
      NAME: 'name',
    },
  },
  {
    key: 'salsa',
    value: 'Salsa',
    token: {
      open: '[[',
      close: ']]',
    },
    lookup: {
      FIRSTNAME: 'First_Name',
      LASTNAME: 'Last_Name',
      EMAIL: 'Email',
    },
  },
  {
    key: 'selligent',
    value: 'Selligent',
    token: {
      open: '',
      close: '',
    },
    lookup: {
      FIRSTNAME: '{firstname}',
      EMAIL: '~MAIL~',
    },
  },
  {
    key: 'sendgrind',
    value: 'SendGrind',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: '%first_name%',
      LASTNAME: '%last_name%',
      EMAIL: '%email%',
      NAME: 'Sender_Name',
    },
  },
  {
    key: 'sendinblue',
    value: 'SendinBlue',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'contact.FIRSTNAME',
      LASTNAME: 'contact.LASTNAME',
      EMAIL: 'contact.EMAIL',
      GENDER: 'contact.GENDER',
    },
  },
  {
    key: 'sendpulse',
    value: 'SendPulse',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'Name',
      EMAIL: 'Email',
      GENDER: 'Gender',
    },
  },
  {
    key: 'sendyco',
    value: 'Sendy.co',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
    format: (variable) => variable.toUpperCase(),
  },
  {
    key: 'sharpspring',
    value: 'SharpSpring',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: '$firstname',
      LASTNAME: '$lastname',
      EMAIL: '$email',
    },
  },
  {
    key: 'silverpop',
    value: 'Silverpop',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'FirstName',
      EMAIL: 'Email',
    },
  },
  {
    key: 'simplero',
    value: 'Simplero',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      NAME: 'fullname',
    },
  },
  {
    key: 'sitecore',
    value: 'Sitecore',
    token: {
      open: '$',
      close: '$',
    },
    lookup: {
      FIRSTNAME: 'firstname',
      LASTNAME: 'lastname',
      EMAIL: 'email',
      NAME: 'name',
    },
    format: (variable) => variable.toLowerCase(),
  },
  {
    key: 'sparkpost',
    value: 'SparkPost',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'address.name',
      EMAIL: 'address.email',
    },
  },
  {
    key: 'campaigner',
    value: 'Campaigner',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'Contact.First Name',
      LASTNAME: 'Contact.Last Name',
      EMAIL: 'Contact.Email',
    },
  },
  {
    key: 'tractionnext',
    value: 'Traction Next',
    token: {
      open: '[!',
      close: '!]',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      LASTNAME: 'Last Name',
      EMAIL: 'Email',
      NAME: 'Name',
      GENDER: 'Gender',
    },
  },
  {
    key: 'verticalresponse',
    value: 'Vertical Response',
    token: {
      open: '{',
      close: '}',
    },
    lookup: {
      FIRSTNAME: 'FIRST_NAME',
      LASTNAME: 'LAST_NAME',
      EMAIL: 'EMAIL_ADDRESS',
      GENDER: 'GENDER',
    },
  },
  {
    key: 'vision6',
    value: 'Vision6',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: 'First_Name',
      EMAIL: 'recipient_email',
    },
  },
  {
    key: 'webpower',
    value: 'Webpower',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'contact.name',
    },
  },
  {
    key: 'whatcounts',
    value: 'WhatCounts',
    token: {
      open: '%%',
      close: '%%',
    },
    lookup: {
      FIRSTNAME: '$first',
      EMAIL: '$email',
    },
  },
  {
    key: 'yamm',
    value: 'YAMM',
    token: {
      open: '{{',
      close: '}}',
    },
    lookup: {
      FIRSTNAME: 'First Name',
      EMAIL: 'Email Address',
    },
  },
  {
    key: 'zoho',
    value: 'Zoho',
    token: {
      open: '$[',
      close: ']$',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
    },
  },
  {
    key: 'sendlane',
    value: 'Sendlane',
    token: {
      open: '',
      close: '',
    },
    lookup: {
      FIRSTNAME: 'VAR_FIRST_NAME',
      LASTNAME: 'VAR_LAST_NAME',
      EMAIL: 'VAR_EMAIL',
      NAME: 'VAR_FULL_NAME',
    },
  },
  {
    key: 'sendreach',
    value: 'SendReach',
    token: {
      open: '[',
      close: ']',
    },
    lookup: {
      FIRSTNAME: 'FNAME',
      LASTNAME: 'LNAME',
      EMAIL: 'EMAIL',
      GENDER: 'GENDER',
    },
    format: (variable) => variable.toUpperCase(),
  },
];
