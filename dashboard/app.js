async function main() {
  const res = await fetch("./data/history.json", { cache: "no-store" });
  const history = res.ok ? await res.json() : [];

  if (history.length === 0) {
    document.getElementById("updated").textContent =
      "아직 데이터가 없습니다. main에 첫 병합이 이루어지면 채워집니다.";
    return;
  }

  const latest = history[history.length - 1];
  document.getElementById("updated").textContent =
    `마지막 업데이트: ${new Date(latest.date).toLocaleString("ko-KR")} · commit ${latest.sha.slice(0, 7)}`;

  const labels = history.map((h) => h.sha.slice(0, 7));

  new Chart(document.getElementById("passRateChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "통과율 (%)",
          data: history.map((h) => h.passRate),
          borderColor: "#22c55e",
          backgroundColor: "#22c55e33",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: baseOptions(0, 100),
  });

  new Chart(document.getElementById("coverageChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Backend",
          data: history.map((h) => h.suites.backend?.coverage?.statements ?? null),
          borderColor: "#3b82f6",
          tension: 0.3,
        },
        {
          label: "Frontend",
          data: history.map((h) => h.suites.frontend?.coverage?.statements ?? null),
          borderColor: "#f59e0b",
          tension: 0.3,
        },
      ],
    },
    options: baseOptions(0, 100),
  });

  new Chart(document.getElementById("durationChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "전체 실행 시간 (초)",
          data: history.map((h) => Math.round((h.totals?.durationMs ?? 0) / 1000)),
          borderColor: "#a78bfa",
          backgroundColor: "#a78bfa33",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: baseOptions(),
  });

  const container = document.getElementById("failedTests");
  if (!latest.failedTests || latest.failedTests.length === 0) {
    container.innerHTML = '<p class="empty">✅ 실패한 테스트가 없습니다.</p>';
  } else {
    const rows = latest.failedTests
      .map(
        (f) =>
          `<tr><td><span class="badge ${f.suite}">${f.suite}</span></td><td>${escapeHtml(f.name)}</td></tr>`,
      )
      .join("");
    container.innerHTML = `<table><thead><tr><th>스위트</th><th>테스트</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
}

function baseOptions(min, max) {
  return {
    responsive: true,
    scales: {
      y: { min, max, ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
      x: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
    },
    plugins: { legend: { labels: { color: "#d1d5db" } } },
  };
}

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

main();
