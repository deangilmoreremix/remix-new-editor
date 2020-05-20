import parser from 'fast-xml-parser';
import he from 'he';

const options = {
  attributeNamePrefix: '@_',
  attrNodeName: 'attr', // default is 'false'
  textNodeName: '#text',
  ignoreAttributes: true,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: '__cdata', // default is 'false'
  cdataPositionChar: '\\c',
  parseTrueNumberOnly: false,
  arrayMode: false, // "strict"
  attrValueProcessor: (val) => he.decode(val, { isAttributeValue: true }),
  tagValueProcessor: (val) => he.decode(val),
  stopNodes: ['parse-me-as-string'],
};

export const validateXML = xmlData => parser.validate(xmlData) === true;

export const xmlToJson = xmlData => {
  let result;
  try {
    if (validateXML(xmlData)) {
      result = parser.parse(xmlData, options);
    }
  } catch (e) {
    console.error('XML parsing failed.', e);
  }
  return result;
};
