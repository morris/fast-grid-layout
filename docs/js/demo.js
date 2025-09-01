export function generateDemoLayout(numberOfItems, columns, noStatics) {
  const layout = [];

  let r = 0;
  let x = 0;

  for (let i = 0; i < numberOfItems; ++i) {
    const y = r;
    const w = Math.min(
      Math.floor(Math.random() * (columns - x)) + 1,
      Math.floor(columns / 2),
    );
    const h = Math.floor((Math.random() * columns) / 2) + 3;

    layout.push({
      x,
      y,
      w,
      h,
      i: i.toString(),
      static: noStatics ? false : i % 9 === 6,
    });

    x = x + w;

    if (x >= columns) {
      x = 0;
      r = r + columns;
    }
  }

  return layout;
}
