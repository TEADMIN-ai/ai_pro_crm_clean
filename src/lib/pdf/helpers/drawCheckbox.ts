export function drawCheckbox(page: any, isChecked: boolean, position: any) {
  if (!isChecked) return;

  page.drawText("X", {
    x: position.x,
    y: position.y,
    size: 12,
  });
}
