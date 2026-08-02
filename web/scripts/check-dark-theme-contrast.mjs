const pairs = [
  ['primary text / app bg', '#f3f6fc', '#0b1220', 4.5],
  ['secondary text / surface 1', '#b6c2d4', '#131e31', 4.5],
  ['muted text / surface 2', '#8492a8', '#18243a', 3],
  ['accent / accent surface', '#78a5ff', '#17315c', 3],
  ['success / success surface', '#56d6a4', '#123a33', 3],
  ['warning / warning surface', '#f6c768', '#3a2d15', 3],
  ['danger / danger surface', '#ff7c86', '#431d26', 3],
  ['event task text / bg', '#e3edff', '#19345d', 4.5],
  ['event call text / bg', '#ece6ff', '#2c234d', 4.5],
  ['event meeting text / bg', '#ddfff9', '#173b3a', 4.5],
  ['event idea text / bg', '#fff1c7', '#3b3019', 4.5],
  ['event note text / bg', '#e8edf6', '#253044', 4.5],
];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channelToLinear(channel) {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const failures = pairs
  .map(([name, foreground, background, min]) => ({
    name,
    ratio: contrast(foreground, background),
    min,
  }))
  .filter(({ ratio, min }) => ratio < min);

if (failures.length) {
  for (const item of failures) {
    console.error(`${item.name}: ${item.ratio.toFixed(2)} < ${item.min}`);
  }
  process.exit(1);
}

console.log(`Dark theme contrast OK (${pairs.length} pairs).`);
