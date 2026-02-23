import clsx from 'clsx';

const OrderStatusBadge = ({ status }) => {
  const classes = clsx('badge', {
    'badge-warning': ['placed', 'accepted'].includes(status),
    'badge-danger': ['rejected', 'cancelled'].includes(status),
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300':
      ['paid', 'shipped', 'delivered'].includes(status),
  });

  return <span className={classes}>{status}</span>;
};

export default OrderStatusBadge;
