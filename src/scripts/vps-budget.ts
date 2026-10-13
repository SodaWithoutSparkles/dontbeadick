import {
  CPU_CLASSES,
  DEFAULT_INPUT,
  buildShareText,
  fromQuery,
  judge,
  money,
  toQuery,
  verdictCopy,
  type LocationId,
  type TribunalInput,
} from '../lib/vps-tribunal';

  const form = document.querySelector<HTMLFormElement>('#tribunal-form')!;
  const badge = document.querySelector<HTMLElement>('#result-badge')!;
  const cpuClassHelp = document.querySelector<HTMLElement>('#cpu-class-help')!;
  const summary = document.querySelector<HTMLElement>('#result-summary')!;
  const body = document.querySelector<HTMLElement>('#result-body')!;
  const fairEl = document.querySelector<HTMLElement>('#result-fair')!;
  const periodTotalEl = document.querySelector<HTMLElement>('#result-period-total')!;
  const budgetEl = document.querySelector<HTMLElement>('#result-budget')!;
  const ratioEl = document.querySelector<HTMLElement>('#result-ratio')!;
  const budgetFill = document.querySelector<HTMLElement>('#budget-fill')!;
  const breakdownList = document.querySelector<HTMLElement>('#breakdown-list')!;
  const breakdownTotal = document.querySelector<HTMLElement>('#breakdown-total')!;
  const tradeList = document.querySelector<HTMLElement>('#trade-list')!;
  const planWrap = document.querySelector<HTMLElement>('#plan-wrap')!;
  const planList = document.querySelector<HTMLElement>('#plan-list')!;
  const planSummary = document.querySelector<HTMLElement>('#plan-summary')!;
  const conflictWrap = document.querySelector<HTMLElement>('#conflict-wrap')!;
  const conflictList = document.querySelector<HTMLElement>('#conflict-list')!;
  const riskList = document.querySelector<HTMLElement>('#risk-list')!;
  const riskSummary = document.querySelector<HTMLElement>('#risk-summary')!;
  const leverWrap = document.querySelector<HTMLElement>('#billing-lever')!;
  const leverLabel = document.querySelector<HTMLElement>('#lever-label')!;
  const leverDetail = document.querySelector<HTMLElement>('#lever-detail')!;
  const leverSaving = document.querySelector<HTMLElement>('#annual-saving')!;
  const trafficWrap = document.querySelector<HTMLElement>('#traffic-amount-wrap')!;
  const transferMode = document.querySelector<HTMLSelectElement>('#transferMode')!;
  const billing = document.querySelector<HTMLSelectElement>('#billing')!;
  const budgetLabel = document.querySelector<HTMLElement>('#budget-label')!;
  const budgetUnit = document.querySelector<HTMLElement>('#budget-unit')!;
  const budgetHelp = document.querySelector<HTMLElement>('#budget-help')!;
  const locationWrap = document.querySelector<HTMLElement>('#location-range-wrap')!;
  const locationEstimates = document.querySelector<HTMLElement>('#location-estimates')!;
  const copyStatus = document.querySelector<HTMLElement>('#copy-status')!;

    const value = (name: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
    const numeric = (name: string, fallback: number) => {
      const field = value(name) as HTMLInputElement | null;
      const parsed = Number.parseFloat(field?.value ?? '');
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    function readInput(): TribunalInput {
      const checkedLocations = Array.from(form!.querySelectorAll<HTMLInputElement>('input[name="locations"]:checked'))
        .map((el) => el.value as LocationId);
      const ipv4 = value('publicIpv4') as HTMLInputElement | null;
      return {
        budget: numeric('budget', DEFAULT_INPUT.budget),
        billing: (value('billing')?.value ?? DEFAULT_INPUT.billing) as TribunalInput['billing'],
        vcpu: numeric('vcpu', DEFAULT_INPUT.vcpu),
        cpuClass: (value('cpuClass')?.value ?? DEFAULT_INPUT.cpuClass) as TribunalInput['cpuClass'],
        ramGb: numeric('ramGb', DEFAULT_INPUT.ramGb),
        ramGeneration: (value('ramGeneration')?.value ?? DEFAULT_INPUT.ramGeneration) as TribunalInput['ramGeneration'],
        nvmeGb: numeric('nvmeGb', DEFAULT_INPUT.nvmeGb),
        ssdGb: numeric('ssdGb', DEFAULT_INPUT.ssdGb),
        hddGb: numeric('hddGb', DEFAULT_INPUT.hddGb),
        portSpeed: (value('portSpeed')?.value ?? DEFAULT_INPUT.portSpeed) as TribunalInput['portSpeed'],
        transferMode: (value('transferMode')?.value ?? DEFAULT_INPUT.transferMode) as TribunalInput['transferMode'],
        transferTb: numeric('transferTb', DEFAULT_INPUT.transferTb),
        locations: checkedLocations,
        publicIpv4: ipv4?.checked ?? true,
      };
    }

    function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = text;
      return node;
    }

    /** An empty configuration hides its section rather than showing a hollow box. */
    function toggle(node: HTMLElement | null, visible: boolean): void {
      node?.classList.toggle('hidden', !visible);
    }

    function renderBillingLabels(period: TribunalInput['billing']) {
      const annual = period === 'annual';
      budgetLabel.textContent = annual ? 'Maximum yearly budget' : 'Maximum monthly budget';
      budgetUnit.textContent = 'USD';
      budgetHelp.textContent = annual
        ? 'Enter what you would pay per year. The estimate is shown as a monthly equivalent.'
        : 'Enter what you would pay per month. Annual billing is priced separately below.';
      document.querySelector('#period-hint')?.classList.toggle('hidden', !annual);
    }

    function render() {
      const input = readInput();
      const verdict = judge(input);
      const copy = verdictCopy(verdict);
      const annual = input.billing === 'annual';

      renderBillingLabels(input.billing);
      badge.textContent = copy.title;
      const selectedCpu = value('cpuClass')?.value as keyof typeof CPU_CLASSES;
      cpuClassHelp.textContent = `${CPU_CLASSES[selectedCpu].examples}. ${CPU_CLASSES[selectedCpu].description}`;
      badge.dataset.verdict = verdict.id;
      summary.textContent = copy.summary;
      body.replaceChildren(...copy.body.map((line) => element('p', 'small-note', line)));

      fairEl.textContent = money(verdict.fair);
      toggle(periodTotalEl, annual);
      if (annual) periodTotalEl!.textContent = `${money(verdict.fairForPeriod)}/year — ${money(verdict.budget)}/month equivalent`;
      breakdownTotal.textContent = money(verdict.fair);

      budgetEl.textContent = `${money(verdict.enteredBudget)}/${annual ? 'yr' : 'mo'}`;
      budgetFill.style.width = `${Math.max(0, Math.min(verdict.ratio * 100, 100))}%`;
      const percent = Math.round(verdict.ratio * 100);
      ratioEl.textContent = verdict.ratio < 1
        ? `Your budget covers ${percent}% of the estimate (${money(verdict.budget)}/mo).`
        : `Your budget is ${percent}% of the estimate (${money(verdict.budget)}/mo).`;

      // Hard conflicts first: nothing else matters until the spec is buildable.
      toggle(conflictWrap, verdict.impossibleReasons.length > 0);
      conflictList.replaceChildren(...verdict.impossibleReasons.map((reason) => element('li', '', reason)));

      const b = verdict.breakdown;
      const allRows: [string, number][] = [
        ['Platform & virtualisation', b.platform], ['CPU', b.cpu], ['Memory', b.ram],
        ['NVMe storage', b.nvme], ['SSD storage', b.ssd], ['HDD storage', b.hdd],
        ['Port speed', b.port],
        [input.transferMode === 'unmetered' ? 'Unmetered traffic' : 'Traffic allowance', b.transfer + b.unmetered],
        ['Public IPv4', b.ipv4],
      ];
      const rows = allRows.filter(([, amount]) => amount > 0.00001);
      breakdownList.replaceChildren(...rows.map(([label, amount]) => {
        const row = element('div', 'breakdown-row', '');
        row.append(element('span', '', label), element('strong', '', money(amount)));
        return row;
      }));

      locationEstimates.replaceChildren();
      if (verdict.locationEstimates.length > 0 && verdict.locationEstimates[0].id !== 'anywhere') {
        locationWrap.classList.remove('hidden');
        for (const estimate of verdict.locationEstimates) {
          const row = element('div', 'estimate-line', '');
          row.append(element('span', '', estimate.label), element('strong', '', `${money(estimate.fair)}/mo`));
          locationEstimates.append(row);
        }
      } else {
        locationWrap.classList.add('hidden');
      }

      tradeList.replaceChildren();
      if (verdict.trades.length === 0) {
        tradeList.append(element('p', 'small-note mt-3', 'No single requirement stands out as a meaningful saving at these rates.'));
      } else {
        for (const trade of verdict.trades.slice(0, 4)) {
          const row = element('div', 'trade-row', '');
          const description = element('div', '', '');
          description.append(element('p', 'trade-name', trade.label), element('p', 'trade-detail', trade.detail));
          const saving = element('p', 'trade-saving', `−${money(trade.saves)}`);
          saving.append(element('span', 'text-[9px] font-medium', '/mo'));
          row.append(description, saving);
          tradeList.append(row);
        }
      }

      // The plan is the route: each step is priced against the previous one.
      // A one-step plan just restates the best trade, so it is not worth a box.
      const plan = verdict.budgetPlan;
      toggle(planWrap, plan.actions.length > 1);
      if (plan.actions.length > 1) {
        planList.replaceChildren(...plan.actions.slice(0, 6).map((action, index) => {
          const row = element('div', 'plan-step', '');
          row.append(
            element('span', 'plan-index', String(index + 1)),
            element('span', 'plan-label', action.label),
            element('span', 'plan-saving', `−${money(action.saves)}/mo`),
          );
          return row;
        }));
        const steps = plan.actions.length === 1 ? '1 change brings' : `${plan.actions.length} changes bring`;
        planSummary.textContent = plan.reachesTarget
          ? `${steps} the estimate to ${money(plan.projectedFair)}/mo — inside your budget.`
          : `Even after ${plan.actions.length} changes the estimate is ${money(plan.projectedFair)}/mo. The budget is not reachable from this spec.`;
      }

      const lever = verdict.levers[0];
      toggle(leverWrap, Boolean(lever));
      if (lever) {
        leverLabel.textContent = lever.label;
        leverDetail.textContent = lever.detail;
        leverSaving.replaceChildren(document.createTextNode(`−${money(lever.saves)}`));
        leverSaving.append(element('span', 'text-[9px] font-medium', '/mo'));
      }

      riskList.replaceChildren(...verdict.risks.map((risk) => element('li', '', risk)));
      riskSummary.textContent = `Things to double-check (${verdict.risks.length})`;
      const nextUrl = `${window.location.pathname}${toQuery(input)}`;
      window.history.replaceState({}, '', nextUrl);
      copyStatus.textContent = '';
    }

    function setInput(input: TribunalInput) {
      const fields: Record<string, string> = {
        budget: String(input.budget), billing: input.billing, vcpu: String(input.vcpu), cpuClass: input.cpuClass,
        ramGb: String(input.ramGb), ramGeneration: input.ramGeneration,
        nvmeGb: String(input.nvmeGb), ssdGb: String(input.ssdGb), hddGb: String(input.hddGb),
        portSpeed: input.portSpeed, transferMode: input.transferMode, transferTb: String(input.transferTb),
      };
      for (const [name, fieldValue] of Object.entries(fields)) {
        const field = value(name);
        if (field) field.value = fieldValue;
      }
      const ipv4 = value('publicIpv4') as HTMLInputElement | null;
      if (ipv4) ipv4.checked = input.publicIpv4;
      for (const field of form!.querySelectorAll<HTMLInputElement>('input[name="locations"]')) {
        field.checked = input.locations.includes(field.value as LocationId);
      }
      trafficWrap.classList.toggle('opacity-50', input.transferMode === 'unmetered');
      const transfer = value('transferTb') as HTMLInputElement | null;
      if (transfer) transfer.disabled = input.transferMode === 'unmetered';
    }

    form.addEventListener('submit', (event) => event.preventDefault());
    form.addEventListener('input', () => {
      const unmetered = transferMode.value === 'unmetered';
      trafficWrap.classList.toggle('opacity-50', unmetered);
      const transfer = value('transferTb') as HTMLInputElement | null;
      if (transfer) transfer.disabled = unmetered;
      render();
    });
    form.addEventListener('change', render);
    document.querySelector<HTMLButtonElement>('#reset-form')?.addEventListener('click', () => {
      setInput(DEFAULT_INPUT);
      render();
    });

    async function copyText(text: string, success: string) {
      try {
        await navigator.clipboard.writeText(text);
        copyStatus.textContent = success;
      } catch {
        copyStatus.textContent = 'Clipboard access was blocked by your browser. Select and copy the text from the generated forum summary if needed.';
      }
    }

    document.querySelector<HTMLButtonElement>('#copy-summary')?.addEventListener('click', () => {
      const input = readInput();
      copyText(buildShareText(input, judge(input)), 'Forum summary copied. Paste it into your thread.');
    });
    document.querySelector<HTMLButtonElement>('#copy-link')?.addEventListener('click', () => {
      copyText(`${window.location.origin}${window.location.pathname}${toQuery(readInput())}`, 'Configuration link copied.');
    });

    // A shared link restores the full configuration; malformed parameters are safely normalised by the judge.
    if (window.location.search) setInput(fromQuery(window.location.search));
    render();
