<!--
  @component
  Sveltia UI components the app doesn’t show, or not in every state, laid out on one sheet so their
  strings can be reviewed: the calendar, the password, secret and number inputs, the combobox, the
  selected tags, a disclosure, a menu item group, a table and a grid with header and footer rows,
  and a dialog with its OK button. A scenario step mounts it over the app in a frame; it uses the
  app’s own copy of Sveltia UI, so its strings are tagged like the app’s.
-->
<script>
  import {
    Calendar,
    Combobox,
    Dialog,
    Disclosure,
    Grid,
    GridBody,
    GridCell,
    GridFoot,
    GridRow,
    Menu,
    MenuItem,
    MenuItemGroup,
    NumberInput,
    Option,
    PasswordInput,
    SecretInput,
    SelectTags,
    Table,
    TableBody,
    TableCell,
    TableFoot,
    TableHead,
    TableRow,
  } from '@sveltia/ui';
  import { onMount } from 'svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [dialog] Whether to open the dialog.
   * @property {boolean} [calendarPopup] Whether to open the calendar’s year and month picker,
   * whose button is labelled with the month shown rather than a message.
   */

  /** @type {Props} */
  let { dialog = false, calendarPopup = false } = $props();

  /** @type {HTMLElement | undefined} */
  let calendarSection = $state();

  onMount(() => {
    if (calendarPopup) {
      /** @type {HTMLElement | null | undefined} */ (
        calendarSection?.querySelector('[aria-haspopup="dialog"]')
      )?.click();
    }
  });

  const OPTIONS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
</script>

<div role="none" class="showcase">
  <section bind:this={calendarSection}>
    <Calendar value="2026-11-15" />
  </section>
  <section>
    <PasswordInput value="password" />
    <SecretInput value="secret" />
    <NumberInput value={5} min={1} max={10} />
    <NumberInput value={5} min={1} />
    <NumberInput value={5} max={10} />
  </section>
  <section>
    <Combobox value="Apple">
      {#each OPTIONS as option (option)}
        <Option label={option} value={option} />
      {/each}
    </Combobox>
    <SelectTags
      options={OPTIONS.map((option) => ({ label: option, value: option }))}
      values={['Apple', 'Banana']}
    />
  </section>
  <section>
    <Disclosure label="Disclosure">Content</Disclosure>
    <Menu>
      <MenuItemGroup label="Group">
        <MenuItem label="Item" />
      </MenuItemGroup>
    </Menu>
  </section>
  <section>
    <Table>
      <TableHead>
        <TableRow><TableCell>Head</TableCell></TableRow>
      </TableHead>
      <TableBody>
        <TableRow><TableCell>Body</TableCell></TableRow>
      </TableBody>
      <TableFoot>
        <TableRow><TableCell>Foot</TableCell></TableRow>
      </TableFoot>
    </Table>
    <Grid>
      <GridBody>
        <GridRow><GridCell>Body</GridCell></GridRow>
      </GridBody>
      <GridFoot>
        <GridRow><GridCell>Foot</GridCell></GridRow>
      </GridFoot>
    </Grid>
  </section>
</div>

<Dialog open={dialog} title="Dialog">Content</Dialog>

<style>
  .showcase {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 24px;
    padding: 24px;
    overflow: auto;
    background-color: var(--sui-primary-background-color, #fff);

    section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }
</style>
