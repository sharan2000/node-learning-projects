const deleteProduct = (btn) => {
  const productArticle = btn.closest("article");
  const productId = btn.parentElement.querySelector("[name=productId]").value;
  const csrf = btn.parentElement.querySelector("[name=_csrf]").value;

  fetch(`/admin/product/${productId}`, {
    method: "DELETE",
    headers: {
      "csrf-token": csrf,
    },
  })
    .then((result) => {
      return result.json();
    })
    .then((result) => {
      productArticle.remove();
    })
    .catch((err) => {
      console.log(err);
    });
};
