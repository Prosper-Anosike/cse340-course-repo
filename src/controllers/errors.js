const testErrorPage = (_request, _response, next) => {
  next(new Error('Intentional test error: <script>alert("test")</script>'));
};

export { testErrorPage };