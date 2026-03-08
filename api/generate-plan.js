export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { answers } = req.body;

  const prompt = `Du bist ein professioneller Triathlon-Trainer. 
Erstelle einen detaillierten 20-Wochen Trainingsplan für einen Athleten mit folgenden Daten:
${JSON.stringify(answers, null, 2)}

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "weeks": [
    {
      "week": 1,
      "phase": "Grundlage",
      "days": [
        {
          "day": 0,
          "sessions": [
            {"type": "swim|bike|run|strength", "title": "...", "detail": "..."}
          ]
        }
      ]
    }
  ]
}`;

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

  const data = await response.json();
  const planText = data.content[0].text;
  const clean = planText.replace(/```json|```/g, '').trim();
  const plan = JSON.parse(clean);

  res.status(200).json({ plan });
}
