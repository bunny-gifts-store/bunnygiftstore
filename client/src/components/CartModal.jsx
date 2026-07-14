import { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { placeOrder, apiError } from '../api.js';
import { formatPrice, resolveImage, formatOrderNo } from '../utils.js';

const EMPTY_FORM = { name: '', email: '', phone: '', pincode: '', address: '', city: '', state: '' };

export default function CartModal() {
  const { cartOpen, closeCart } = useUI();
  const { items, removeItem, changeQuantity, setQuantity, total, count, clear } = useCart();
  const { user } = useAuth();

  const [step, setStep] = useState('cart'); // cart | checkout | payment
  const [form, setForm] = useState(EMPTY_FORM);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState(null);

  // Reset to cart view each time the modal opens; prefill from the logged-in user.
  useEffect(() => {
    if (cartOpen) {
      setStep('cart');
      setError('');
      setTransactionId('');
      setForm((f) => ({
        ...EMPTY_FORM,
        ...f,
        name: f.name || user?.username || '',
        phone: f.phone || user?.mobile || '',
      }));
    }
  }, [cartOpen, user]);

  if (!cartOpen) return null;

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const goPayment = () => {
    const required = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode'];
    if (required.some((k) => !String(form[k]).trim())) {
      setError('Please complete all shipping details before continuing.');
      return;
    }
    setError('');
    setStep('payment');
  };

  const submitOrder = async () => {
    if (!transactionId.trim()) {
      setError('Please enter the Transaction ID from your PhonePe app before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await placeOrder({
        ...form,
        transactionId: transactionId.trim(),
        totalAmount: total,
        totalItems: count,
        items: items.map((i) => ({
          code: i.code, name: i.name, size: i.size || '', image: i.image || '',
          quantity: i.quantity, unitPrice: i.pricePerUnit || i.price,
        })),
      });

      // Show the themed confirmation screen instead of a browser alert.
      setOrderNumber(res.id);
      clear();
      setStep('success');
    } catch (err) {
      setError(apiError(err, 'Unable to save the order right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog"
           onClick={(e) => { if (e.target.classList.contains('modal')) closeCart(); }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {step === 'cart' ? 'Your Cart'
                  : step === 'checkout' ? 'Shipping / Delivery Address'
                  : step === 'payment' ? 'PhonePe Payment'
                  : 'Order Confirmed'}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeCart}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {step === 'cart' && (
                <CartPreview
                  items={items} total={total} count={count}
                  removeItem={removeItem} changeQuantity={changeQuantity} setQuantity={setQuantity}
                  onCheckout={() => setStep('checkout')}
                />
              )}

              {step === 'checkout' && (
                <CheckoutForm form={form} setField={setField} onBack={() => setStep('cart')} onNext={goPayment} />
              )}

              {step === 'payment' && (
                <PaymentStep
                  transactionId={transactionId} setTransactionId={setTransactionId}
                  submitting={submitting} onSubmit={submitOrder}
                />
              )}

              {step === 'success' && <OrderSuccess orderNumber={orderNumber} />}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={closeCart}></div>
    </>
  );
}

function OrderSuccess({ orderNumber }) {
  return (
    <div className="order-success text-center">
      <div className="order-success-check" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h3 className="order-success-title">Order Placed Successfully! 🎉</h3>
      {orderNumber && <p className="order-success-number">Order {formatOrderNo(orderNumber)}</p>}
      <p className="order-success-text">
        Thank you for shopping with Bunny Gift Store. Your order and payment details have been
        received. We'll process it right away.
      </p>
    </div>
  );
}

function CartPreview({ items, total, count, removeItem, changeQuantity, setQuantity, onCheckout }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-5">
        <h5>Your cart is empty</h5>
        <p className="text-muted">Add premium products to start your order.</p>
      </div>
    );
  }
  return (
    <>
      <div className="mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
          <div>
            <h5 className="mb-1">Cart Preview</h5>
            <p className="text-muted mb-0">{count} selected item{count > 1 ? 's' : ''}</p>
          </div>
          <div className="text-md-end">
            <div className="fs-5 fw-semibold">Total: {formatPrice(total)}</div>
          </div>
        </div>
      </div>

      {items.map((item, index) => {
        const q = item.quantity || 1;
        const unit = item.pricePerUnit || item.price;
        return (
          <div className="card mb-3" key={`${item.id}-${item.size || ''}`}>
            <div className="row g-0 align-items-center">
              <div className="col-auto p-3">
                <img src={resolveImage(item.image)} alt={item.name} className="img-fluid cart-item-thumbnail" draggable="false" />
              </div>
              <div className="col">
                <div className="card-body py-3">
                  <h5 className="card-title mb-2">{item.name}</h5>
                  <p className="mb-1"><strong>Code:</strong> {item.code}</p>
                  {item.size && <p className="mb-1"><strong>Size:</strong> {item.size}</p>}
                  <p className="mb-1"><strong>Unit Price:</strong> {formatPrice(unit)}</p>
                  <p className="mb-1"><strong>Item Total:</strong> {formatPrice(unit * q)}</p>
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => changeQuantity(index, -1)}>-</button>
                    <input type="number" className="form-control form-control-sm cart-quantity-input" value={q} min="1"
                           onChange={(e) => setQuantity(index, e.target.value)} />
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => changeQuantity(index, 1)}>+</button>
                  </div>
                </div>
              </div>
              <div className="col-auto pe-3">
                <button className="btn btn-outline-danger" onClick={() => removeItem(index)}>Remove</button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mt-3">
        <div><strong>Total Items:</strong> {count}</div>
        <button className="btn btn-primary btn-lg" onClick={onCheckout}>Proceed to Place The Order</button>
      </div>
    </>
  );
}

function CheckoutForm({ form, setField, onBack, onNext }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }}>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Full Name</label>
          <input type="text" className="form-control" value={form.name} onChange={setField('name')} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={form.email} onChange={setField('email')} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Phone Number</label>
          <input type="tel" className="form-control" value={form.phone} onChange={setField('phone')} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Pincode</label>
          <input type="text" className="form-control" value={form.pincode} onChange={setField('pincode')} required />
        </div>
        <div className="col-12">
          <label className="form-label">Address</label>
          <textarea className="form-control" rows="3" value={form.address} onChange={setField('address')} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">City</label>
          <input type="text" className="form-control" value={form.city} onChange={setField('city')} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">State</label>
          <input type="text" className="form-control" value={form.state} onChange={setField('state')} required />
        </div>
      </div>
      <div className="mt-4 d-flex justify-content-between flex-column flex-md-row gap-3">
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back to Cart</button>
        <button type="submit" className="btn btn-primary">Payment</button>
      </div>
    </form>
  );
}

function PaymentStep({ transactionId, setTransactionId, submitting, onSubmit }) {
  return (
    <>
      <p className="text-muted">Scan the QR code below using PhonePe and then enter your transaction ID to complete the order.</p>
      <div className="qr-payment-wrapper text-center py-3">
        <div className="qr-image-frame">
          <img src="/images/payment-qr.png" alt="PhonePe Payment QR Code" className="qr-payment-image" draggable="false" />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="transactionIdInput" className="form-label fw-semibold">Transaction ID</label>
        <input id="transactionIdInput" type="text" className="form-control form-control-lg"
               placeholder="Enter your PhonePe transaction ID" autoComplete="off"
               value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required />
        <small className="text-muted">Please enter the transaction ID shown in your PhonePe app after the payment.</small>
      </div>
      <div className="mt-4 text-center">
        <button type="button" className="btn btn-primary btn-lg" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Placing Order…' : 'Place the Order'}
        </button>
      </div>
    </>
  );
}
