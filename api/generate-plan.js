export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { answers } = req.body;

  const trainingDays = Array.isArray(answers.training_days)
    ? answers.training_days.join(', ')
    : answers.training_days;

  const prompt = `Du bist ein professioneller Triathlon-Trainer. Erstelle einen detaillierten Trainingsplan für einen Athleten mit folgenden Daten:

- Gewicht: ${answers.weight} kg
- Fitnesslevel: ${answers.fitness_level}
- Schwimmzeit 1,9 km: ${answers.swim_time}
- Radzeit 90 km: ${answers.bike_time}
- Laufzeit Halbmarathon: ${answers.run_time}
- Zielzeit Wettkampf: ${answers.target_time}
- Trainingstage: ${trainingDays}
- Kraftsport: ${answers.strength}

Wichtige Hinweise:
- Plane nur auf den angegebenen Trainingstagen
- Krafttraining (falls gewünscht) sinnvoll in den Plan einordnen, 1-2x pro Woche, in der Taper-Phase reduzieren
- Anzahl Wochen: 20
- Ernährungsempfehlungen basierend auf dem Gewicht mitgeben

Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach, keine Markdown-Backticks. Format:
{
  "weeks": [
    {
      "week": 1,
      "phase": "Grundlage",
      "days": [
        {
          "day": 0,
          "sessions": [
            {"type": "swim", "title": "Schwimmen", "detail": "1200m locker"}
          ]
        }
      ]
    }
  ],
  "nutrition": {
    "base_carbs": "300-350",
    "base_protein": "120-130",
    "intensive_carbs": "420-500",
    "intensive_protein": "130-145"
  }
}

day ist 0=Montag, 1=Dienstag, 2=Mittwoch, 3=Donnerstag, 4=Freitag, 5=Samstag, 6=Sonntag.
type ist eines von: swim, bike, run, strength.`;

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
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'Anthropic API Fehler: ' + errText });
    }

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      console.error('Unexpected response structure:', JSON.stringify(data));
      return res.status(500).json({ error: 'Unerwartete API-Antwort', details: JSON.stringify(data) });
    }

    const planText = data.content[0].text;

    let plan;
    try {
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      const clean = jsonMatch ? jsonMatch[0] : planText.replace(/```json\n?|```\n?/g, '').trim();
      plan = JSON.parse(clean);
    } catch(parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', planText);
      return res.status(500).json({ error: 'JSON Parse Fehler', raw: planText.substring(0, 200) });
    }

    res.status(200).json({ plan });

  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}
