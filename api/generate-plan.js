export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { answers } = req.body;

  const trainingDays = Array.isArray(answers.training_days)
    ? answers.training_days.join(', ')
    : answers.training_days;

  const prompt = `Du bist ein professioneller Triathlon-Trainer. Erstelle einen Trainingsplan für einen Athleten:

- Gewicht: ${answers.weight} kg
- Fitnesslevel: ${answers.fitness_level}
- Schwimmzeit 1,9 km: ${answers.swim_time}
- Radzeit 90 km: ${answers.bike_time}
- Laufzeit Halbmarathon: ${answers.run_time}
- Zielzeit Wettkampf: ${answers.target_time}
- Trainingstage: ${trainingDays}
- Kraftsport: ${answers.strength}

Regeln:
- Nur auf den genannten Trainingstagen planen
- Krafttraining 1-2x/Woche sinnvoll einordnen, in Taper-Phase reduzieren
- Genau 20 Wochen
- day: 0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So
- type: swim, bike, run oder strength
- Halte detail-Texte kurz (max 100 Zeichen)

Antworte AUSSCHLIESSLICH mit raw JSON, absolut kein Text oder Backticks davor oder danach:
{"weeks":[{"week":1,"phase":"Grundlage","days":[{"day":0,"sessions":[{"type":"swim","title":"Schwimmen","detail":"1200m locker"}]}]}],"nutrition":{"base_carbs":"300-350","base_protein":"120-130","intensive_carbs":"420-500","intensive_protein":"130-145"}}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Anthropic API Fehler: ' + errText });
    }

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'Unerwartete API-Antwort', details: JSON.stringify(data) });
    }

    let planText = data.content[0].text.trim();

    // Entferne Backticks falls vorhanden
    planText = planText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // Extrahiere JSON-Block
    const start = planText.indexOf('{');
    const end = planText.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: planText.substring(0, 300) });
    }
    const jsonStr = planText.substring(start, end + 1);

    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch(parseErr) {
      return res.status(500).json({ error: 'JSON Parse Fehler', raw: jsonStr.substring(0, 300) });
    }

    res.status(200).json({ plan });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
