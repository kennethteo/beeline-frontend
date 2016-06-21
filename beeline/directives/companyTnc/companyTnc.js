

export default function companyTnc(CompanyService, $q) {
  return {
    template: require('./companyTnc.html'),
    replace: false,
    scope: {
      companyId: '=',
    },
    link: function(scope, elem, attr) {
      scope.company = {};

      scope.$watch('companyId', function() {
        if (!scope.companyId) {
          scope.company = null;
          return;
        }

        var companyPromise = CompanyService.getCompany(scope.companyId)
        .then((company) => {
          scope.company = company;
          return company;
        });

        var featuresPromise = CompanyService.getFeatures(scope.companyId)
        $q.all([featuresPromise, companyPromise])
        .then(([features, company]) => {
          company.featuresHTML = features;
        });
      });

      scope.showTerms = () => {
        if (!scope.company) return;

        CompanyService.showTerms(scope.company.id);
      }
    }
  };
}
