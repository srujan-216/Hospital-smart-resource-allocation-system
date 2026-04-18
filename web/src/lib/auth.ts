export function isAdmin() {
  return !!localStorage.getItem("admin_token");
}
export function setAdminToken(token: string, username: string) {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_username", username);
}
export function clearAdmin() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");
}
export function adminUser() {
  return localStorage.getItem("admin_username") || "admin";
}
