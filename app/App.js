import $ from 'jquery';
import _ from 'underscore';
import util from './Util';
import render from './Render';
import search from './Search';


const SPREADSHEET_ID = '1kq6z9cEeqqGL5R5mdclkj5HjD-w9dvL8xCYmhG1UziQ';


class App {
  constructor() {
    this.resetFilters();
  }

  resetFilters() {
    this.filters = {
      flags: [],
      rating: -1,
      categories: [],
      services: [],
      state: false,
      sortByRating: false
    };
  }

  loadSpreadsheet(num, onLoad) {
    var url = `https://spreadsheets.google.com/feeds/list/${SPREADSHEET_ID}/${num}/public/full?alt=json`;
    $.ajax({
      url: url,
      success: data => onLoad(data.feed.entry)
    });
  }

  loadOrgs(onLoad) {
    this.loadSpreadsheet(1, rows => {
      this.orgs = _.chain(rows).map((row, i) => {
        var obj = util.parseGSXRow(row);

        // skip if no name
        if (!obj.name) return;

        // some extra parsing
        obj.id = i;
        obj.rating = util.parseRating(obj.charitynavigatorrating);
        obj.deductible = util.parseBool(obj.taxdeductibleyn);
        obj.accredited = util.parseBool(obj.accreditedbusinessyn);
        obj.categories = _.compact([obj.category1, obj.category2, obj.category3]);
        obj.additionalServices = _.compact([obj.filter1, obj.filter2, obj.filter3]);
        obj.description = obj.description100characters;
        obj.donatelink = util.trim(obj.donatelink);
        obj.volunteerlink = util.trim(obj.volunteerlink);
        obj.number = util.parseNumber(obj.numbers);
        obj.services = [];
        if (obj.donatelink) obj.services.push('donations');
        if (obj.volunteerlink) obj.services.push('volunteers');
        obj.services = obj.services.concat(obj.additionalServices);

        // console.log(obj); // debug

        return obj;
      }).compact().value();
      onLoad();
    });
  }

  updateAvailableFilters(results) {
    var filters = [];
    $('[data-flag=deductible]').attr('disabled', !_.some(results, r => r.deductible));
    $('[data-flag=accredited]').attr('disabled', !_.some(results, r => r.accredited));
    $('.filters-services button').each(function() {
      var service = $(this).data('service');
      $(this).attr('disabled',
        !_.some(results, r => _.contains(r.services, service)));
    });
  }

  loadCategories() {
    this.loadSpreadsheet(2, rows => {
      this.categories = _.map(rows, row => {
        var cat = util.parseGSXRow(row).category;
        $('.filters-categories').append(
          `<button data-category="${cat}" title="${util.slugify(cat)}">${util.slugify(cat)}</button>`);
        return cat;
      });
    });
  }

  loadSubCategories() {
    this.loadSpreadsheet(3, rows => {
      this.categories = _.map(rows, row => {
        var cat = util.parseGSXRow(row)['sub-category'];
        $('.filters-subcategories').append(
          `<button data-subcategory="${cat}">${cat}</button>`);
        return cat;
      });
    });
  }

  loadServices() {
    this.loadSpreadsheet(4, rows => {
      this.services = _.map(rows, row => {
        var service = util.parseGSXRow(row).service;
        $('.filters-services').append(
          `<button data-service="${service}">${util.slugify(service)}</button>`);
        return service;
      });
    });
  }

  bindRatingFilter() {
    $('.filters-rating').on('click', ev => {
      var el = $(ev.target);
      el.toggleClass('selected');
      this.filters.sortByRating = el.hasClass('selected');
      this.renderResults();
    });
  }

  bindSharing() {
    $('.results').on('click', '.action-share', ev => {
      var id = $(ev.target).data('id'),
          parent = $(ev.target).closest('.result'),
          org = this.orgs[id],
          html = render.sharing(org);
      parent.find('.result-sharing').html(html).show();
    }).on('mouseleave', '.result', ev => {
      $('.result-sharing').hide();
    });
  }

  bindFilter(sel, dataName, filterType) {
    $(sel).on('click', 'button', ev => {
      var el = $(ev.target),
          filter = el.data(dataName);
      el.toggleClass('selected');
      if (el.hasClass('selected')) {
        this.filters[filterType].push(filter);
      } else {
        this.filters[filterType] = _.without(this.filters[filterType], filter);
      }
      this.renderResults();
      return false;
    });
  }

  bindClear() {
    $('.clear-filters').on('click', ev => {
      this.results = this.orgs;
      this.resetFilters();
      this.renderResults();
      $('.selected').removeClass('selected');
      $('input[name=search]').val('');
    });
  }

  bindSearch() {
    $('input[name=search]').on('keyup', ev => {
      this.search();
    });
  }

  bindStateFilter() {
    $('.results').on('click', '.result-state', ev => {
      var state = $(ev.target).data('state');
      this.filters.state = state;
      this.renderResults();
    });
  }

  bindSearchDropdown() {
    $('.search-dropdown').on('click', 'li', ev => {
      var name = $(ev.target).data('name');
      $('input[name=search]').val(name);
      this.search();
      $('.search-dropdown').hide();
    });
    $('.search-wrapper').on('mouseleave', ev => {
      $('.search-dropdown').hide();
    });
  }

  bindFiltersToggle() {
    $('.toggle-filters').on('click', ev => {
      $('.filters-all-content').toggle();
    });
  }

  search() {
    var query = $('input[name=search]').val();
    if (query) {
      this.results = _.map(search.search(query), res => {
        return this.orgs[res.ref];
      });
      this.renderResults();
      this.renderSearchNames();
    } else {
      $('.search-dropdown').hide();
      this.results = this.orgs;
      this.renderResults();
    }
  }

  renderSearchNames() {
    var names = _.pluck(this.results, 'name').slice(0, 5),
        html = _.map(names, name => `<li data-name="${name}">${name}</li>`);
    $('.search-dropdown').html(html.join('')).show();
  }

  renderResults() {
    var html = [],
        results = search.filter(this.results, this.filters);
    if (results.length > 0) {
      _.each(results, result => {
        html.push(render.result(result));
      });
      if (this.filters.state) {
        html = [`<h2 class="filters-state">Showing organizations for <b>${this.filters.state}</b></h2>`].concat(html);
      }
      $('.results > ul').html(html.join(''));
    } else {
      $('.results > ul').html('<h1 class="no-results">No results</h1>');
    }
    this.updateAvailableFilters(results);
  }

  run() {
    this.loadOrgs(() => {
      this.results = this.orgs;
      this.renderResults();
      search.index(this.orgs);
    });
    this.loadServices();
    this.loadCategories();
    this.loadSubCategories();

    this.bindSearch();
    this.bindClear();
    this.bindSharing();
    this.bindRatingFilter();
    this.bindFiltersToggle();
    this.bindSearchDropdown();
    this.bindStateFilter();
    this.bindFilter('.filters-flags', 'flag', 'flags');
    this.bindFilter('.filters-categories', 'category', 'categories');
    this.bindFilter('.filters-services', 'service', 'services');
  }
}

export default App;