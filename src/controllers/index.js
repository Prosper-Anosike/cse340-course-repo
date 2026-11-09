const showHomePage = (_request, response) => {
  response.render('home', {
    title: 'Home',
    heading: 'Welcome to the CSE 340 Service Network!',
    currentPath: '/',
  });
};

export { showHomePage };