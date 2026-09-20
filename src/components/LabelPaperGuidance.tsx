import { LabelSheetLink } from './LabelSheetLink'

export function LabelPaperGuidance() {
  return <>
    <p>Use 63.5 mm (2.5-inch) round labels. Choose the matching paper in Print labels:</p>
    <ul>
      <li>US Letter: Avery 94502, nine labels per sheet. <LabelSheetLink />.</li>
      <li>A4: twelve labels per sheet, using <a href="https://uk.onlinelabels.com/products/eu30023" target="_blank" rel="noreferrer">OnlineLabels EU30023<span className="visually-hidden"> (opens in a new tab)</span></a> or <a href="https://www.labelplanet.co.uk/removable-labels-white-paper/lp12-64r-rem/" target="_blank" rel="noreferrer">Label Planet LP12/64R removable paper<span className="visually-hidden"> (opens in a new tab)</span></a>.</li>
    </ul>
    <p className="field-hint">These are not affiliate links. Check inkjet or laser compatibility and delivery to your country before ordering. Other A4 layouts and 60 mm circles do not match these presets.</p>
    <p className="field-hint">You can also print on plain printer paper, cut out the labels, and attach them to your jar lids with a glue stick. Check that a 63.5 mm circle fits the flat area of your lid before buying sheets or printing.</p>
  </>
}
