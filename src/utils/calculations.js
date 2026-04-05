/**
 * Given a list of expenses and settlements within a group,
 * returns a { userId: netAmount } map.
 *
 * Positive = the user is OWED money.
 * Negative = the user OWES money.
 */
export function calculateNetBalances(expenses, settlements, members) {
  const net = {};
  members.forEach((id) => { net[id] = 0; });

  expenses.forEach(({ paidBy, splitAmong }) => {
    if (!paidBy || !Array.isArray(splitAmong)) return;
    splitAmong.forEach(({ userId, amount }) => {
      net[paidBy] = (net[paidBy] ?? 0) + amount;
      net[userId] = (net[userId] ?? 0) - amount;
    });
  });

  settlements.forEach(({ paidBy, paidTo, amount }) => {
    if (!paidBy || !paidTo) return;
    net[paidBy] = (net[paidBy] ?? 0) + amount;  // settled debt
    net[paidTo] = (net[paidTo] ?? 0) - amount;   // received cash
  });

  return net;
}

/**
 * Derive minimum transactions to settle all debts.
 * Returns an array of { from, to, amount } objects.
 */
export function calculateMinTransactions(netBalances) {
  const debtors = [];   // owe money (negative net)
  const creditors = []; // are owed money (positive net)

  Object.entries(netBalances).forEach(([uid, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) debtors.push({ userId: uid, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ userId: uid, amount: rounded });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const settle = Math.min(debtors[i].amount, creditors[j].amount);
    transactions.push({
      from: debtors[i].userId,
      to: creditors[j].userId,
      amount: Math.round(settle * 100) / 100,
    });
    debtors[i].amount -= settle;
    creditors[j].amount -= settle;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return transactions;
}

/**
 * Split an amount equally among a list of user IDs.
 * Returns an array of { userId, amount } objects.
 */
export function splitEqually(amount, userIds) {
  if (!userIds.length) return [];
  const share = Math.floor((amount / userIds.length) * 100) / 100;
  const remainder = Math.round((amount - share * userIds.length) * 100) / 100;
  return userIds.map((uid, idx) => ({
    userId: uid,
    amount: idx === 0 ? Math.round((share + remainder) * 100) / 100 : share,
  }));
}

/** Format a number as Indian Rupees string */
export function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
