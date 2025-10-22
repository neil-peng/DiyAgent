export const setToken = (token) => {
  localStorage.setItem("token", token);
};

export const getToken = () => {
  return "Bearer "+ localStorage.getItem("token");
};