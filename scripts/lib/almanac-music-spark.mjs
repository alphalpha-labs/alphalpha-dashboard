const FORMATS = ["riff", "production-breakdown", "sound-experiment", "creative-constraint", "short-exercise"];

function sourceUrl(item) {
  return item?.sourceUrl || (item?.videoId ? `https://youtu.be/${item.videoId}` : undefined);
}

export function buildMusicSparkCandidates({ riff, production } = {}) {
  const candidates = [];
  if (riff) {
    candidates.push({
      id: `riff:${riff.videoId}`,
      format: "riff",
      kicker: "Learn a musical phrase",
      title: riff.title,
      creator: riff.artist,
      why: riff.why,
      tryThisNow: `Spend 10 minutes learning the smallest complete phrase. Loop it slowly, then change the final note once.`,
      durationMinutes: 10,
      videoId: riff.videoId,
      start: riff.start,
      sourceUrl: sourceUrl(riff),
      tags: [riff.genre, riff.difficulty, "guitar"].filter(Boolean),
      quality: 9,
    });
    candidates.push({
      id: `exercise:${riff.videoId}`,
      format: "short-exercise",
      kicker: "A 10-minute practice",
      title: `Turn one phrase into three variations`,
      creator: riff.artist,
      why: riff.note || riff.why,
      tryThisNow: `Play the phrase once as written, once with a different rhythm, and once ending on a new note. Record all three without stopping.`,
      durationMinutes: 10,
      videoId: riff.videoId,
      start: riff.start,
      sourceUrl: sourceUrl(riff),
      tags: [riff.genre, "variation", "recording"].filter(Boolean),
      quality: 8.5,
    });
  }
  if (production) {
    candidates.push({
      id: `production:${production.videoId}`,
      format: "production-breakdown",
      kicker: "Steal a production move",
      title: production.title,
      creator: production.creator,
      why: production.why,
      tryThisNow: `Watch for one technique, then recreate only that move in a blank eight-bar session.`,
      durationMinutes: 15,
      videoId: production.videoId,
      start: production.start,
      sourceUrl: sourceUrl(production),
      tags: [production.daw, production.technique].filter(Boolean),
      quality: 9,
    });
    candidates.push({
      id: `sound:${production.videoId}`,
      format: "sound-experiment",
      kicker: "Make a new sound",
      title: `Resample until the source disappears`,
      creator: production.creator,
      why: production.note || production.why,
      tryThisNow: `Create one sound, resample it to audio, pitch it an octave, reverse one slice, and save the result as a new instrument.`,
      durationMinutes: 12,
      videoId: production.videoId,
      start: production.start,
      sourceUrl: sourceUrl(production),
      tags: [production.daw, "resampling", "sound design"].filter(Boolean),
      quality: 8.7,
    });
  }
  if (riff && production) {
    candidates.push({
      id: `constraint:${riff.videoId}:${production.videoId}`,
      format: "creative-constraint",
      kicker: "A constraint to start a track",
      title: "One riff, one resample, eight bars",
      creator: "Alphalpha",
      why: "It connects guitar vocabulary to your production practice and removes the blank-page problem.",
      tryThisNow: `Record one take of the riff, resample it once, and build eight bars using only that audio plus drums. No new instruments for 15 minutes.`,
      durationMinutes: 15,
      videoId: riff.videoId,
      start: riff.start,
      sourceUrl: sourceUrl(riff),
      tags: [riff.genre, production.technique, "constraint"].filter(Boolean),
      quality: 9.2,
    });
  }
  return candidates;
}

export function selectMusicSpark(candidates, { recentIds = [], feedback = {} } = {}) {
  if (!candidates?.length) return null;
  const recentFormats = recentIds.map(id => String(id).split(":")[0]);
  return [...candidates].sort((a, b) => score(b) - score(a))[0];

  function score(candidate) {
    const formatUses = recentFormats.filter(format => format === candidate.format).length;
    const exactRepeat = recentIds.includes(`${candidate.format}:${candidate.id}`) ? 1 : 0;
    const blob = `${candidate.format} ${candidate.tags.join(" ")}`.toLowerCase();
    let affinity = 0;
    for (const [chip, count] of Object.entries(feedback?.chipTallies || {})) {
      if (blob.includes(String(chip).replace(/^more\s+/, "").toLowerCase())) affinity += Number(count) * 0.5;
    }
    return candidate.quality + affinity - formatUses * 3 - exactRepeat * 20;
  }
}

export { FORMATS as MUSIC_SPARK_FORMATS };
