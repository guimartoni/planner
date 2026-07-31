export default function Avatar({ user }) {
  if (!user) return null;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
      style={{ background: user.color, fontSize: 10, fontWeight: 700 }}>
      {initials}
    </span>
  );
}
