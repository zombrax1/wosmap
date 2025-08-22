(function() {
  const nativeAlert = window.alert;
  window.alert = function(message) {
    if (window.Swal) {
      Swal.fire({
        text: String(message),
        confirmButtonColor: '#6366f1'
      });
    } else {
      nativeAlert(message);
    }
  };
})();
