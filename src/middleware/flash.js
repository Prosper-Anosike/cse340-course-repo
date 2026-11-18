const flash = (request, response, next) => {
  const pendingMessages = request.session.flashMessages ?? {};
  delete request.session.flashMessages;

  request.flash = (type, message) => {
    if (message === undefined) {
      return pendingMessages[type] ?? [];
    }

    request.session.flashMessages ??= {};
    request.session.flashMessages[type] ??= [];
    request.session.flashMessages[type].push(message);
    return request.session.flashMessages[type];
  };

  response.locals.flash = pendingMessages;
  next();
};

export default flash;