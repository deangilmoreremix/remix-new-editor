import { describe, it, expect } from 'vitest';
import { parseToScreenplay, parseFdx, splitScenes, parseHeading, importScript, sceneCharacters, sceneDialogue, serializeScreenplay } from '../screenplay.js';

const FOUNTAIN = `Title: The Test
Author: Me

INT. KITCHEN - NIGHT

Maya pours coffee. [[a note]]

MAYA
(whispering)
Did you hear that?

JONAS (V.O.)
It's just the wind.

CUT TO:

.SNOWY ROOFTOP

@McCLANE
Yippee.
/* boneyard
cut stuff */
`;

const FDX = `<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content>
<Paragraph Type="Scene Heading"><Text>EXT. BEACH - DAY</Text></Paragraph>
<Paragraph Type="Action"><Text>Waves &amp; gulls.</Text></Paragraph>
<Paragraph Type="Character"><Text>SAM</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Nice </Text><Text>day.</Text></Paragraph>
</Content><ElementSettings Type="Action"><FontSpec Font="Courier Final Draft"/></ElementSettings></FinalDraft>`;

describe('screenplay import (ported from CineGen)', () => {
  it('parses Fountain with title page, notes, forced elements', () => {
    const { elements } = parseToScreenplay(FOUNTAIN);
    expect(elements.map((e) => e.type)).toEqual(['scene', 'action', 'character', 'parenthetical', 'dialogue', 'character', 'dialogue', 'transition', 'scene', 'character', 'dialogue']);
    expect(elements[1].text).toBe('Maya pours coffee.');
    expect(elements[8].text).toBe('SNOWY ROOFTOP');
    expect(elements[9].text).toBe('McCLANE');
    expect(elements.some((e) => /Title|boneyard/.test(e.text))).toBe(false);
  });
  it('splits scenes with heading metadata, characters and dialogue', () => {
    const scenes = splitScenes(parseToScreenplay(FOUNTAIN));
    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toMatchObject({ heading: 'INT. KITCHEN - NIGHT', intExt: 'INT', timeOfDay: 'NIGHT', place: 'KITCHEN' });
    expect(sceneCharacters(scenes[0])).toEqual(['MAYA', 'JONAS']);
    expect(sceneDialogue(scenes[0])[1]).toEqual({ character: 'JONAS', text: "It's just the wind." });
    expect(parseHeading('INT./EXT. CAR — MOMENTS LATER')).toMatchObject({ intExt: 'INT./EXT', timeOfDay: 'MOMENTS LATER' });
  });
  it('parses Final Draft and drops the settings trailer', () => {
    const doc = parseFdx(FDX);
    expect(doc.elements.map((e) => [e.type, e.text])).toEqual([['scene', 'EXT. BEACH - DAY'], ['action', 'Waves & gulls.'], ['character', 'SAM'], ['dialogue', 'Nice day.']]);
    const imp = importScript(FDX, 'x.fdx');
    expect(imp.scenes).toHaveLength(1);
    expect(parseToScreenplay(serializeScreenplay(doc)).elements.map((e) => e.type)).toEqual(['scene', 'action', 'character', 'dialogue']);
  });
});
