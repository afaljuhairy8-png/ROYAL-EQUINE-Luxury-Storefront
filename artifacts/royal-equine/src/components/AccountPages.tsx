import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser, StoreOrder } from "@workspace/api-client-react";
import { ArrowRight, Check, Package, UserRound } from "lucide-react";

type Lang = "en" | "ar";
const t = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);
const money = (value: number) =>
  `${value.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;

export function AccountPage({
  lang,
  mode,
  navigate,
  onAuthenticated,
}: {
  lang: Lang;
  mode: "login" | "signup";
  navigate: (path: string) => void;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = isSignup
      ? {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }
      : {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        };

    try {
      const response = await fetch(`/api/auth/${isSignup ? "sign-up" : "login"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | AuthUser
        | { error?: string }
        | null;
      if (!response.ok || !result || !("id" in result)) {
        throw new Error(result && "error" in result ? result.error : undefined);
      }
      onAuthenticated(result);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : t(lang, "We could not sign you in. Please try again.", "تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="account-page page-wrap">
      <div className="account-shell">
        <div className="account-intro">
          <span className="section-kicker">{t(lang, "ROYAL EQUINE · CLIENT ACCOUNT", "رويال إكويني · حساب العميل")}</span>
          <h1>{isSignup ? t(lang, "A more personal equestrian experience.", "تجربة فروسية أكثر خصوصية.") : t(lang, "Welcome back to the atelier.", "مرحباً بعودتك إلى الأتيليه.")}</h1>
          <p>
            {isSignup
              ? t(lang, "Create an account to keep your details and follow every order from our Kuwait atelier.", "أنشئ حساباً لحفظ بياناتك ومتابعة طلباتك من أتيليه الكويت.")
              : t(lang, "Sign in to view your orders and continue with your saved shopping bag.", "سجل الدخول لمتابعة طلباتك وإكمال حقيبة التسوق المحفوظة.")}
          </p>
          <div className="account-trust"><span><Check size={15} />{t(lang, "Private client service", "خدمة عملاء خاصة")}</span><span><Check size={15} />{t(lang, "Kuwait delivery", "توصيل داخل الكويت")}</span></div>
        </div>

        <form className="account-form" onSubmit={submit}>
          <div className="account-form-mark"><UserRound size={20} /></div>
          <h2>{isSignup ? t(lang, "Create your account", "إنشاء حساب") : t(lang, "Client sign in", "تسجيل دخول العميل")}</h2>
          <p>{t(lang, "Your account is protected with encrypted password storage.", "حسابك محمي بتخزين آمن ومشفّر لكلمة المرور.")}</p>
          {isSignup && (
            <label>
              {t(lang, "Full name", "الاسم الكامل")}
              <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
            </label>
          )}
          <label>
            {t(lang, "Email address", "البريد الإلكتروني")}
            <input name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
          <label>
            {t(lang, "Password", "كلمة المرور")}
            <input name="password" type="password" required minLength={8} maxLength={128} autoComplete={isSignup ? "new-password" : "current-password"} />
          </label>
          {isSignup && <small className="account-hint">{t(lang, "Use at least 8 characters.", "استخدم ٨ أحرف على الأقل.")}</small>}
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="button-dark account-submit" type="submit" disabled={submitting}>
            {submitting
              ? t(lang, "Please wait…", "يرجى الانتظار…")
              : isSignup
                ? t(lang, "Create account", "إنشاء الحساب")
                : t(lang, "Sign in", "تسجيل الدخول")}
            <ArrowRight size={16} />
          </button>
          <div className="account-switch">
            <span>{isSignup ? t(lang, "Already a client?", "لديك حساب؟") : t(lang, "New to Royal Equine?", "عميل جديد لدى رويال إكويني؟")}</span>
            <button type="button" onClick={() => navigate(`${isSignup ? "/login" : "/signup"}${window.location.search}`)}>
              {isSignup ? t(lang, "Sign in", "تسجيل الدخول") : t(lang, "Create an account", "إنشاء حساب")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export function OrdersPage({
  user,
  lang,
  navigate,
}: {
  user: AuthUser;
  lang: Lang;
  navigate: (path: string) => void;
}) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/orders", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          navigate("/login?next=%2Forders");
          return [];
        }
        if (!response.ok) {
          throw new Error(t(lang, "Your orders are temporarily unavailable.", "طلباتك غير متاحة مؤقتاً."));
        }
        return (await response.json()) as StoreOrder[];
      })
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : t(lang, "Your orders are temporarily unavailable.", "طلباتك غير متاحة مؤقتاً."),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lang, navigate]);

  return (
    <main className="account-page orders-page page-wrap">
      <div className="orders-heading">
        <div>
          <span className="section-kicker">{t(lang, "ROYAL EQUINE · PRIVATE CLIENT", "رويال إكويني · العميل الخاص")}</span>
          <h1>{t(lang, "My Orders", "طلباتي")}</h1>
          <p>{t(lang, `Welcome, ${user.name}. Your orders are kept here for you.`, `مرحباً ${user.name}. ستجد طلباتك محفوظة هنا.`)}</p>
        </div>
        <button className="back-link" onClick={() => navigate("/")}>{t(lang, "Continue shopping", "متابعة التسوق")} <ArrowRight size={16} /></button>
      </div>

      {loading ? (
        <div className="account-state">{t(lang, "Loading your orders…", "جارٍ تحميل طلباتك…")}</div>
      ) : error ? (
        <div className="account-state account-error" role="alert">{error}</div>
      ) : orders.length === 0 ? (
        <div className="account-state orders-empty">
          <Package size={27} />
          <h2>{t(lang, "Your first order is yet to be placed.", "لم تقم بإجراء أول طلب بعد.")}</h2>
          <p>{t(lang, "Once you place an order, its details and delivery status will appear here.", "ستظهر تفاصيل طلبك وحالة التوصيل هنا بعد إتمامه.")}</p>
          <button className="button-dark" onClick={() => navigate("/")}>{t(lang, "Explore the collection", "اكتشف المجموعة")} <ArrowRight size={16} /></button>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-heading">
                <div><span className="section-kicker">{t(lang, "ORDER REFERENCE", "رقم الطلب")}</span><b>{order.orderNumber}</b></div>
                <span className={`order-status ${order.status}`}>{order.status === "paid" ? t(lang, "Paid", "مدفوع") : t(lang, "Received", "مستلم")}</span>
              </div>
              <div className="order-card-meta">
                <span>{new Date(order.createdAt).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-KW", { year: "numeric", month: "long", day: "numeric" })}</span>
                <span>{order.items.reduce((count, item) => count + item.quantity, 0)} {t(lang, "items", "منتجات")}</span>
                <b>{money(order.total)}</b>
              </div>
              <div className="order-card-items">
                {order.items.map((item) => (
                  <div key={item.productId} className="order-card-item">
                    <img src={item.image} alt="" loading="lazy" />
                    <span>{lang === "ar" ? item.nameAr : item.name}<small>{t(lang, "Quantity", "الكمية")}: {item.quantity}</small></span>
                    <b>{money(item.price * item.quantity)}</b>
                  </div>
                ))}
              </div>
              <div className="order-delivery">
                <span>{t(lang, "Delivering to", "التوصيل إلى")}: {order.delivery.area}</span>
                <span>{t(lang, "Payment arranged with our Kuwait concierge", "ترتيبات الدفع مع فريق خدمة العملاء في الكويت")}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
